import AVFoundation
import UIKit
import Vision

// Delegate receives a captured image when the auto-capture conditions are met.
protocol CameraManagerDelegate: AnyObject {
    func cameraManager(_ manager: CameraManager, didCaptureImage image: UIImage)
    func cameraManager(_ manager: CameraManager, didDetectCard rect: CGRect?, isReady: Bool)
}

final class CameraManager: NSObject, ObservableObject {
    weak var delegate: CameraManagerDelegate?

    let session = AVCaptureSession()
    private var photoOutput = AVCapturePhotoOutput()
    private var videoOutput = AVCaptureVideoDataOutput()
    private let sessionQueue = DispatchQueue(label: "camera.session")
    private let analysisQueue = DispatchQueue(label: "camera.analysis", qos: .userInitiated)

    // Auto-capture state
    @Published var cardDetected = false
    @Published var captureReady = false
    @Published var isCapturing = false

    private var consecutiveReadyFrames = 0
    private let requiredConsecutiveFrames = 8   // ~0.27s at 30fps
    private var lastCaptureTime: Date = .distantPast
    private let minCaptureInterval: TimeInterval = 2.5

    // Rectangle request reused across frames
    private lazy var rectangleRequest: VNDetectRectanglesRequest = {
        let req = VNDetectRectanglesRequest()
        req.minimumAspectRatio = 0.55   // card is ~2.5" x 3.5" = 0.714
        req.maximumAspectRatio = 0.85
        req.minimumSize = 0.25          // must occupy at least 25% of frame area
        req.minimumConfidence = 0.75
        req.maximumObservations = 1
        return req
    }()

    // MARK: - Setup

    func configure() {
        sessionQueue.async { [weak self] in
            self?.setupSession()
        }
    }

    private func setupSession() {
        session.beginConfiguration()
        session.sessionPreset = .photo

        guard let device = bestCamera(),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else {
            session.commitConfiguration()
            return
        }
        session.addInput(input)

        // Configure for continuous autofocus + auto exposure
        configureDevice(device)

        // Photo output for high-res capture
        if session.canAddOutput(photoOutput) {
            session.addOutput(photoOutput)
            photoOutput.isHighResolutionCaptureEnabled = true
        }

        // Video output for real-time analysis
        videoOutput.setSampleBufferDelegate(self, queue: analysisQueue)
        videoOutput.alwaysDiscardsLateVideoFrames = true
        if session.canAddOutput(videoOutput) {
            session.addOutput(videoOutput)
            videoOutput.connection(with: .video)?.videoOrientation = .portrait
        }

        session.commitConfiguration()
        session.startRunning()
    }

    private func bestCamera() -> AVCaptureDevice? {
        if let wide = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) {
            return wide
        }
        return AVCaptureDevice.default(for: .video)
    }

    private func configureDevice(_ device: AVCaptureDevice) {
        try? device.lockForConfiguration()
        if device.isFocusModeSupported(.continuousAutoFocus) {
            device.focusMode = .continuousAutoFocus
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
        sessionQueue.async { [weak self] in
            self?.session.stopRunning()
        }
    }

    // MARK: - Manual capture trigger

    func capturePhoto() {
        guard !isCapturing else { return }
        isCapturing = true
        let settings = AVCapturePhotoSettings()
        settings.isHighResolutionPhotoEnabled = true
        photoOutput.capturePhoto(with: settings, delegate: self)
    }

    // MARK: - Frame analysis

    private func analyzeFrame(_ pixelBuffer: CVPixelBuffer) {
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up)
        try? handler.perform([rectangleRequest])

        let observation = rectangleRequest.results?.first as? VNRectangleObservation
        let blurScore = bluriness(of: pixelBuffer)
        let isSharp = blurScore > 80     // Laplacian variance threshold

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }

            let cardRect = observation.map { self.normalize($0.boundingBox) }
            let isReady = observation != nil && isSharp
            self.cardDetected = observation != nil
            self.captureReady = isReady

            self.delegate?.cameraManager(self, didDetectCard: cardRect, isReady: isReady)

            if isReady {
                self.consecutiveReadyFrames += 1
                if self.consecutiveReadyFrames >= self.requiredConsecutiveFrames,
                   Date().timeIntervalSince(self.lastCaptureTime) > self.minCaptureInterval {
                    self.consecutiveReadyFrames = 0
                    self.lastCaptureTime = Date()
                    self.capturePhoto()
                }
            } else {
                self.consecutiveReadyFrames = 0
            }
        }
    }

    // Laplacian variance — higher = sharper
    private func bluriness(of pixelBuffer: CVPixelBuffer) -> Float {
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let filter = CIFilter(name: "CILaplacian")!
        filter.setValue(ciImage, forKey: kCIInputImageKey)
        guard let output = filter.outputImage else { return 0 }

        let context = CIContext()
        var bitmap = [UInt8](repeating: 0, count: 4)
        context.render(output,
                       toBitmap: &bitmap,
                       rowBytes: 4,
                       bounds: CGRect(x: ciImage.extent.midX, y: ciImage.extent.midY, width: 1, height: 1),
                       format: .RGBA8,
                       colorSpace: nil)
        return Float(bitmap[0])
    }

    private func normalize(_ rect: CGRect) -> CGRect {
        // Vision coords are bottom-left origin; flip Y for UIKit
        CGRect(x: rect.minX, y: 1 - rect.maxY, width: rect.width, height: rect.height)
    }
}

// MARK: - AVCaptureVideoDataOutputSampleBufferDelegate

extension CameraManager: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        analyzeFrame(pixelBuffer)
    }
}

// MARK: - AVCapturePhotoCaptureDelegate

extension CameraManager: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        DispatchQueue.main.async { [weak self] in
            self?.isCapturing = false
        }
        guard error == nil,
              let data = photo.fileDataRepresentation(),
              let image = UIImage(data: data) else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.delegate?.cameraManager(self, didCaptureImage: image)
        }
    }
}
