import AVFoundation
import UIKit
import Vision

// MARK: - Detection state

struct CardDetectionState {
    enum Phase { case searching, detected, locking, capturing }
    let phase: Phase
    /// Normalized rect in UIKit coords (top-left origin, 0–1). Smoothed via EMA.
    let normalizedRect: CGRect?
    /// 0–1: how far through the stability window we are before auto-capture fires.
    let captureProgress: Float
    /// Laplacian variance of the card region. Exposed for debug overlays.
    let blurScore: Float
}

// MARK: - Delegate

protocol CameraManagerDelegate: AnyObject {
    /// Called with a perspective-corrected, card-cropped image ready to send to the API.
    func cameraManager(_ manager: CameraManager, didCaptureCard image: UIImage)
    func cameraManager(_ manager: CameraManager, detectionDidUpdate state: CardDetectionState)
}

// MARK: - CameraManager

final class CameraManager: NSObject {
    weak var delegate: CameraManagerDelegate?

    let session = AVCaptureSession()
    private let photoOutput   = AVCapturePhotoOutput()
    private let videoOutput   = AVCaptureVideoDataOutput()
    private let sessionQueue  = DispatchQueue(label: "cam.session", qos: .userInitiated)
    private let analysisQueue = DispatchQueue(label: "cam.analysis", qos: .userInitiated)

    // Shared GPU-backed CIContext — NEVER allocate inside a per-frame path.
    private let ciContext = CIContext(options: [.useSoftwareRenderer: false,
                                                .cacheIntermediates: true])

    private weak var captureDevice: AVCaptureDevice?

    // MARK: Frame throttle (all state is analysis-queue only)

    /// Analyze every (frameSkip+1)-th frame → ~10fps analysis at 30fps camera.
    private let frameSkip = 2
    private var frameCounter = 0

    // MARK: Detection state (analysis-queue only)

    /// Consecutive frames that pass all quality checks. Does not hard-reset; decays gracefully.
    private var qualityFrameCount: Float = 0
    /// Number of quality frames required to trigger capture.
    private let requiredQualityFrames: Float = 10  // ~1 s at 10 fps analysis
    /// Rate at which bad frames drain the counter (per bad frame).
    private let decayRate: Float = 1.5
    private var lastCaptureTime = Date.distantPast
    private let minCaptureInterval: TimeInterval = 2.5

    /// Smoothed normalized rect (UIKit coords) for the UI overlay.
    private var smoothedRect: CGRect?
    /// EMA alpha: 0=never moves, 1=always jumps to current. 0.3 gives gentle tracking.
    private let smoothAlpha: CGFloat = 0.30

    /// Last rect for stability checking.
    private var previousRect: CGRect?

    // MARK: - Setup

    func configure() {
        sessionQueue.async { self.setupSession() }
    }

    private func setupSession() {
        session.beginConfiguration()
        session.sessionPreset = .photo  // allows high-res photo capture

        guard let device = preferredCamera(),
              let input  = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else {
            session.commitConfiguration()
            return
        }
        session.addInput(input)
        captureDevice = device
        configureDevice(device)

        // Photo output — use maxPhotoDimensions (iOS 16+) for highest resolution.
        if session.canAddOutput(photoOutput) {
            session.addOutput(photoOutput)
            if #available(iOS 16, *) {
                photoOutput.maxPhotoDimensions = photoOutput.maxPhotoDimensions
            } else {
                photoOutput.isHighResolutionCaptureEnabled = true
            }
        }

        // Video output — request YCbCr so we can access the luma plane directly
        // without a color-conversion step in the blur path.
        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String:
                kCVPixelFormatType_420YpCbCr8BiPlanarFullRange
        ]
        videoOutput.setSampleBufferDelegate(self, queue: analysisQueue)
        videoOutput.alwaysDiscardsLateVideoFrames = true

        if session.canAddOutput(videoOutput) {
            session.addOutput(videoOutput)
            videoOutput.connection(with: .video)?.videoOrientation = .portrait
        }

        session.commitConfiguration()
        session.startRunning()
    }

    /// Prefer the 2× telephoto camera for card scanning — it provides less perspective
    /// distortion at close range than the wide-angle lens.
    private func preferredCamera() -> AVCaptureDevice? {
        let preferred: [AVCaptureDevice.DeviceType] = [
            .builtInTelephotoCamera,
            .builtInWideAngleCamera,
        ]
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: preferred, mediaType: .video, position: .back
        )
        return discovery.devices.first ?? AVCaptureDevice.default(for: .video)
    }

    private func configureDevice(_ device: AVCaptureDevice) {
        try? device.lockForConfiguration()
        if device.isFocusModeSupported(.continuousAutoFocus) {
            device.focusMode = .continuousAutoFocus
        }
        // Restrict autofocus to near objects so it doesn't hunt to the background.
        if device.isAutoFocusRangeRestrictionSupported {
            device.autoFocusRangeRestriction = .near
        }
        if device.isExposureModeSupported(.continuousAutoExposure) {
            device.exposureMode = .continuousAutoExposure
        }
        if device.isWhiteBalanceModeSupported(.continuousAutoWhiteBalance) {
            device.whiteBalanceMode = .continuousAutoWhiteBalance
        }
        device.unlockForConfiguration()
    }

    func stop() {
        sessionQueue.async { self.session.stopRunning() }
    }

    // MARK: - Torch

    func setTorch(on: Bool) {
        sessionQueue.async {
            guard let device = self.captureDevice, device.hasTorch else { return }
            try? device.lockForConfiguration()
            device.torchMode = on ? .on : .off
            device.unlockForConfiguration()
        }
    }

    // MARK: - Manual capture

    func triggerManualCapture() {
        sessionQueue.async { self.fireCapture() }
    }

    // MARK: - Frame analysis (runs entirely on analysisQueue)

    private func analyzeFrame(_ pixelBuffer: CVPixelBuffer) {
        // Frame throttle — skip frames to reduce CPU load to ~10fps analysis.
        frameCounter = (frameCounter + 1) % (frameSkip + 1)
        guard frameCounter == 0 else { return }

        // Run Vision rectangle detection.
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer,
                                            orientation: .up, options: [:])
        let req = makeRectangleRequest()
        try? handler.perform([req])

        // Pick the best observation (highest confidence × closeness to center).
        let observations = req.results ?? []
        guard let best = selectBestObservation(from: observations) else {
            qualityFrameCount = max(0, qualityFrameCount - decayRate)
            smoothedRect = nil
            previousRect = nil
            reportState(.init(phase: .searching, normalizedRect: nil,
                              captureProgress: 0, blurScore: 0))
            return
        }

        // Blur: Laplacian variance on the card region only.
        let blur = laplacianVariance(in: pixelBuffer, region: best.boundingBox)
        let isSharp = blur > 320

        // Stability: check that the card hasn't moved significantly since last frame.
        let currentRect = visionToUIKitNorm(best.boundingBox)
        let isStable: Bool
        if let prev = previousRect {
            isStable = rectMovementDelta(currentRect, prev) < 0.018
        } else {
            isStable = false
        }
        previousRect = currentRect

        // Smooth the rect for the UI overlay (EMA).
        smoothedRect = emaRect(current: currentRect, previous: smoothedRect, alpha: smoothAlpha)

        // Update quality frame counter — graceful decay rather than hard reset.
        let qualityPass = isSharp && isStable && best.confidence > 0.78
        if qualityPass {
            qualityFrameCount = min(qualityFrameCount + 1, requiredQualityFrames)
        } else {
            qualityFrameCount = max(0, qualityFrameCount - decayRate)
        }

        let progress = qualityFrameCount / requiredQualityFrames
        let phase: CardDetectionState.Phase

        if qualityFrameCount >= requiredQualityFrames &&
           Date().timeIntervalSince(lastCaptureTime) > minCaptureInterval {
            phase = .capturing
            qualityFrameCount = 0
            lastCaptureTime = Date()
            sessionQueue.async { self.fireCapture() }
        } else if qualityFrameCount > 0 {
            phase = .locking
        } else {
            phase = .detected
        }

        reportState(.init(phase: phase,
                          normalizedRect: smoothedRect,
                          captureProgress: Float(min(1, progress)),
                          blurScore: blur))
    }

    // MARK: - Vision request factory

    private func makeRectangleRequest() -> VNDetectRectanglesRequest {
        let req = VNDetectRectanglesRequest()
        // Wide tolerances — perspective distortion can skew the apparent aspect ratio
        // of a card (nominally 0.714) by 20–30% even at moderate angles.
        req.minimumAspectRatio = 0.45
        req.maximumAspectRatio = 0.95
        // Allow cards at greater distances — 12% of frame's short dimension.
        req.minimumSize        = 0.12
        req.minimumConfidence  = 0.70
        // Evaluate up to 3 candidates so we can pick the best, not just the first.
        req.maximumObservations = 3
        return req
    }

    // MARK: - Candidate selection

    private func selectBestObservation(from observations: [VNObservation]) -> VNRectangleObservation? {
        let rects = observations.compactMap { $0 as? VNRectangleObservation }
        guard !rects.isEmpty else { return nil }
        // Score = confidence × (1 − distance from frame center).
        // This picks the most-centered, highest-confidence rectangle.
        return rects.max { a, b in
            score(a) < score(b)
        }
    }

    private func score(_ obs: VNRectangleObservation) -> Float {
        let cx = Float(obs.boundingBox.midX - 0.5)
        let cy = Float(obs.boundingBox.midY - 0.5)
        let distFromCenter = sqrt(cx*cx + cy*cy)  // 0 = dead center, ~0.7 = corner
        return obs.confidence * (1 - distFromCenter)
    }

    // MARK: - Blur detection (Laplacian variance on luma plane)
    //
    // Correct approach: compute variance of the discrete Laplacian over the card region.
    // A blurry image has low-contrast edges → small Laplacian values → low variance.
    // A sharp image has high-contrast edges → large Laplacian values → high variance.
    // Threshold ~300 works well for card scanning at normal phone-to-card distances.
    //
    // Key correctness decisions vs the original implementation:
    //   - Operates on many pixels across the card region, not a single center pixel.
    //   - Accesses the Y (luma) plane of the YCbCr buffer directly — no CIContext needed.
    //   - Strided sampling (every 6th pixel) keeps it fast at full sensor resolution.
    //   - Confined to the detected card bounding box — ignores noisy background.

    private func laplacianVariance(in pixelBuffer: CVPixelBuffer, region: CGRect) -> Float {
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

        // Access Y (luma) plane — plane 0 of YCbCr.
        let planeCount = CVPixelBufferGetPlaneCount(pixelBuffer)
        guard planeCount > 0,
              let base = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0) else { return 0 }

        let bpr    = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)
        let width  = CVPixelBufferGetWidthOfPlane(pixelBuffer, 0)
        let height = CVPixelBufferGetHeightOfPlane(pixelBuffer, 0)
        let bytes  = base.assumingMemoryBound(to: UInt8.self)

        // Map Vision bounding box (bottom-left origin) → pixel coordinates.
        let x0 = max(1, Int(region.minX * CGFloat(width)))
        let y0 = max(1, Int((1 - region.maxY) * CGFloat(height)))
        let x1 = min(width  - 2, Int(region.maxX * CGFloat(width)))
        let y1 = min(height - 2, Int((1 - region.minY) * CGFloat(height)))

        guard x1 > x0 + 4, y1 > y0 + 4 else { return 0 }

        // Stride: sample ~40×40 points across the region regardless of its pixel size.
        let stride = max(1, min((x1 - x0) / 40, (y1 - y0) / 40))

        var sum:   Float = 0
        var sumSq: Float = 0
        var n:     Float = 0

        var y = y0 + 1
        while y < y1 - 1 {
            var x = x0 + 1
            while x < x1 - 1 {
                let idx = y * bpr + x
                // 4-neighbor discrete Laplacian: ∇²f ≈ -4c + n + s + e + w
                let lap = 4 * Int32(bytes[idx])
                         - Int32(bytes[idx - 1])
                         - Int32(bytes[idx + 1])
                         - Int32(bytes[(y - 1) * bpr + x])
                         - Int32(bytes[(y + 1) * bpr + x])
                let f = Float(lap)
                sum   += f
                sumSq += f * f
                n     += 1
                x += stride
            }
            y += stride
        }

        guard n > 0 else { return 0 }
        let mean = sum / n
        return (sumSq / n) - (mean * mean)  // Var = E[X²] − E[X]²
    }

    // MARK: - Coordinate helpers

    /// Convert a Vision bounding box (bottom-left origin, 0–1 normalized)
    /// to UIKit normalized coordinates (top-left origin, 0–1).
    private func visionToUIKitNorm(_ rect: CGRect) -> CGRect {
        CGRect(x: rect.minX, y: 1 - rect.maxY, width: rect.width, height: rect.height)
    }

    private func emaRect(current: CGRect, previous: CGRect?, alpha: CGFloat) -> CGRect {
        guard let prev = previous else { return current }
        func ema(_ c: CGFloat, _ p: CGFloat) -> CGFloat { p + alpha * (c - p) }
        return CGRect(x:      ema(current.minX,   prev.minX),
                      y:      ema(current.minY,   prev.minY),
                      width:  ema(current.width,  prev.width),
                      height: ema(current.height, prev.height))
    }

    private func rectMovementDelta(_ a: CGRect, _ b: CGRect) -> CGFloat {
        let dCenter = sqrt(pow(a.midX - b.midX, 2) + pow(a.midY - b.midY, 2))
        let dSize   = max(abs(a.width - b.width), abs(a.height - b.height))
        return dCenter + dSize * 0.5
    }

    // MARK: - Delegate dispatch

    private func reportState(_ state: CardDetectionState) {
        DispatchQueue.main.async { self.delegate?.cameraManager(self, detectionDidUpdate: state) }
    }

    // MARK: - Photo capture (called on sessionQueue)

    private func fireCapture() {
        // sessionQueue.async is already the caller's responsibility.
        if #available(iOS 16, *) {
            let settings = AVCapturePhotoSettings()
            settings.maxPhotoDimensions = photoOutput.maxPhotoDimensions
            photoOutput.capturePhoto(with: settings, delegate: self)
        } else {
            let settings = AVCapturePhotoSettings()
            settings.isHighResolutionPhotoEnabled = true
            photoOutput.capturePhoto(with: settings, delegate: self)
        }
    }
}

// MARK: - AVCaptureVideoDataOutputSampleBufferDelegate

extension CameraManager: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput,
                       didOutput sampleBuffer: CMSampleBuffer,
                       from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        analyzeFrame(pixelBuffer)
    }
}

// MARK: - AVCapturePhotoCaptureDelegate

extension CameraManager: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput,
                     didFinishProcessingPhoto photo: AVCapturePhoto,
                     error: Error?) {
        guard error == nil,
              let data = photo.fileDataRepresentation(),
              let ciImage = CIImage(data: data) else { return }

        // Re-run rectangle detection on the full-resolution captured photo.
        // Using the video-frame observation's normalized coordinates would introduce
        // error because the video frame and photo can have different aspect ratios and
        // field-of-view crops. Running Vision fresh on the photo is the most accurate
        // approach for perspective correction.
        let corrected = perspectiveCorrectedCard(from: ciImage) ?? UIImage(data: data)!

        DispatchQueue.main.async {
            self.delegate?.cameraManager(self, didCaptureCard: corrected)
        }
    }

    // MARK: - Perspective correction
    //
    // VNDetectRectanglesRequest gives us the four corners of the card in the image.
    // CIPerspectiveCorrection warps those corners to a flat rectangle, yielding a
    // front-parallel card image regardless of how much it was tilted or rotated.
    // This substantially improves GPT-4o identification accuracy for angled cards.

    private func perspectiveCorrectedCard(from ciImage: CIImage) -> UIImage? {
        let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
        let req = VNDetectRectanglesRequest()
        req.minimumAspectRatio  = 0.45
        req.maximumAspectRatio  = 0.95
        req.minimumSize         = 0.10
        req.minimumConfidence   = 0.60
        req.maximumObservations = 1
        try? handler.perform([req])

        guard let obs = req.results?.first as? VNRectangleObservation else { return nil }

        let w = ciImage.extent.width
        let h = ciImage.extent.height

        // Vision uses bottom-left origin; CIPerspectiveCorrection uses the same convention.
        guard let filter = CIFilter(name: "CIPerspectiveCorrection") else { return nil }
        filter.setValue(ciImage, forKey: kCIInputImageKey)
        filter.setValue(CIVector(x: obs.topLeft.x     * w, y: obs.topLeft.y     * h), forKey: "inputTopLeft")
        filter.setValue(CIVector(x: obs.topRight.x    * w, y: obs.topRight.y    * h), forKey: "inputTopRight")
        filter.setValue(CIVector(x: obs.bottomLeft.x  * w, y: obs.bottomLeft.y  * h), forKey: "inputBottomLeft")
        filter.setValue(CIVector(x: obs.bottomRight.x * w, y: obs.bottomRight.y * h), forKey: "inputBottomRight")

        guard let outputCI = filter.outputImage else { return nil }

        // Render to a standard card size (500×700 px at 1×) for the API.
        // This normalizes cards to a consistent input size for GPT-4o.
        let targetSize = CGSize(width: 600, height: 840)
        guard let cgImage = ciContext.createCGImage(outputCI, from: outputCI.extent) else { return nil }

        let renderer = UIGraphicsImageRenderer(size: targetSize)
        return renderer.image { _ in
            UIImage(cgImage: cgImage).draw(in: CGRect(origin: .zero, size: targetSize))
        }
    }
}
