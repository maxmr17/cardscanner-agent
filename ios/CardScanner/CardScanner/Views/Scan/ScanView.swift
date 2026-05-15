import SwiftUI
import AVFoundation

struct ScanView: View {
    @StateObject private var viewModel = ScanViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                CameraPreviewView(session: viewModel.cameraManager.session)
                    .ignoresSafeArea()

                CardScanOverlay(
                    detectionState: viewModel.detectionState,
                    isSending: viewModel.isSending
                )

                VStack {
                    Spacer()
                    ScanStatusBanner(
                        state: viewModel.detectionState,
                        isSending: viewModel.isSending
                    )
                    .padding(.horizontal)
                    .padding(.bottom, 40)
                }
            }
            .navigationTitle("Scan Card")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        viewModel.toggleTorch()
                    } label: {
                        Image(systemName: viewModel.torchOn ? "flashlight.on.fill" : "flashlight.off.fill")
                            .foregroundColor(viewModel.torchOn ? .yellow : .white)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Manual") { viewModel.manualCapture() }
                        .foregroundColor(.white)
                        .disabled(viewModel.isCapturing)
                }
            }
            .onAppear  { viewModel.startCamera() }
            .onDisappear { viewModel.stopCamera() }
            .sheet(item: $viewModel.capturedSession) { session in
                ScanResultSheet(session: session)
            }
            .alert("Scan Error", isPresented: $viewModel.showError) {
                Button("OK") {}
            } message: {
                Text(viewModel.errorMessage)
            }
        }
    }
}

// MARK: - Camera preview

struct CameraPreviewView: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewUIView {
        let v = PreviewUIView()
        v.session = session
        return v
    }

    func updateUIView(_ uiView: PreviewUIView, context: Context) {}
}

final class PreviewUIView: UIView {
    var session: AVCaptureSession? {
        didSet {
            guard let s = session else { return }
            (layer as! AVCaptureVideoPreviewLayer).session = s
        }
    }

    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }

    override func layoutSubviews() {
        super.layoutSubviews()
        let preview = layer as! AVCaptureVideoPreviewLayer
        preview.videoGravity = .resizeAspectFill
        preview.frame = bounds
    }
}

// MARK: - Overlay

/// Full-screen overlay that draws:
///   1. A dimmed vignette outside the card guide rectangle.
///   2. Corner brackets at the guide rect that animate green when locking.
///   3. A circular capture-progress arc that fills as stability builds.
///   4. An orange highlight around the live-detected card rect (mapped from Vision coords).
struct CardScanOverlay: View {
    let detectionState: CardDetectionState
    let isSending: Bool

    var body: some View {
        GeometryReader { geo in
            let guide = guideFrame(in: geo.size)

            ZStack {
                // Vignette: darken everything outside the guide.
                Color.black.opacity(0.45)
                    .mask(
                        Rectangle()
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .frame(width: guide.width, height: guide.height)
                                    .position(x: guide.midX, y: guide.midY)
                                    .blendMode(.destinationOut)
                            )
                    )
                    .allowsHitTesting(false)

                // Detected card highlight — maps normalized Vision rect to screen coords.
                // The camera uses .resizeAspectFill so we apply the aspect-fill transform.
                if let normRect = detectionState.normalizedRect {
                    let screenRect = aspectFillRect(normRect, in: geo.size)
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.orange.opacity(0.75), lineWidth: 2)
                        .frame(width: screenRect.width, height: screenRect.height)
                        .position(x: screenRect.midX, y: screenRect.midY)
                        .animation(.easeInOut(duration: 0.08), value: normRect)
                        .allowsHitTesting(false)
                }

                // Corner brackets drawn at the guide rect.
                let bracketColor: Color = {
                    switch detectionState.phase {
                    case .locking, .capturing: return .green
                    case .detected:            return .orange
                    case .searching:           return .white
                    }
                }()
                CornerBrackets(rect: guide, color: bracketColor)
                    .animation(.easeInOut(duration: 0.2), value: detectionState.phase == .locking)
                    .allowsHitTesting(false)

                // Circular capture-progress arc centred below the guide.
                if detectionState.phase == .locking || detectionState.phase == .capturing || isSending {
                    CaptureProgressArc(
                        progress: isSending ? 1.0 : CGFloat(detectionState.captureProgress),
                        isSending: isSending
                    )
                    .position(x: guide.midX, y: guide.maxY + 32)
                    .allowsHitTesting(false)
                }
            }
        }
        .ignoresSafeArea()
    }

    // MARK: - Guide geometry

    /// Card-proportioned guide rect (2.5″ × 3.5″ = 0.714 ratio), centred in the screen.
    private func guideFrame(in size: CGSize) -> CGRect {
        let width  = size.width * 0.78
        let height = width / 0.714   // standard card aspect ratio
        let x = (size.width  - width)  / 2
        let y = (size.height - height) / 2 - 20  // slightly above center
        return CGRect(x: x, y: y, width: width, height: height)
    }

    // MARK: - Aspect-fill coordinate mapping
    //
    // The camera preview uses .resizeAspectFill. If the video frame has a different
    // aspect ratio from the screen, part of the frame is cropped. Vision normalized
    // coords (0–1) refer to the full video frame, not the cropped visible portion.
    //
    // We assume the video frame is 9:16 portrait (1080×1920).
    // The screen is taller than 9:16 on modern iPhones (roughly 9:19.5).
    // .resizeAspectFill scales the 9:16 frame until its WIDTH fills the screen,
    // then the bottom of the frame overflows below the visible area.
    //
    //   visibleHeightFraction = screenHeight / (screenWidth * 16/9)
    //   topCrop = (1 − visibleHeightFraction) / 2
    //
    // Y mapping: normY_vision → (normY_vision − topCrop) / visibleHeightFraction
    // X mapping: normX_vision → normX_vision  (no horizontal crop for portrait video)

    private func aspectFillRect(_ normRect: CGRect, in size: CGSize) -> CGRect {
        // Video frame native aspect ratio (portrait 9:16).
        let videoAspect: CGFloat = 9.0 / 16.0
        let screenAspect = size.width / size.height

        let scaleX: CGFloat
        let scaleY: CGFloat
        let offsetX: CGFloat
        let offsetY: CGFloat

        if screenAspect > videoAspect {
            // Screen is wider than video → video fills width, height is cropped.
            scaleX  = size.width / (size.width)   // 1.0 — no horizontal crop
            scaleY  = size.width / (size.width * videoAspect / screenAspect)
            offsetX = 0
            offsetY = (size.height - size.width / videoAspect) / 2
        } else {
            // Screen is taller than video → video fills height, width is cropped.
            let scaledWidth = size.height * videoAspect
            scaleX  = size.width / scaledWidth   // >1 if cropped
            scaleY  = 1.0
            offsetX = (size.width - scaledWidth) / 2
            offsetY = 0
        }

        _ = scaleX; _ = scaleY  // suppress unused warnings for symmetry

        // For the common portrait-phone case: video 9:16, screen ~9:19.5.
        // Screen is taller → scale video to fill height, crop width equally on both sides.
        let scaledVW = size.height * videoAspect
        let cropX = (size.width - scaledVW) / 2   // negative = video wider than screen

        let x      = normRect.minX * scaledVW + cropX
        let y      = normRect.minY * size.height
        let width  = normRect.width  * scaledVW
        let height = normRect.height * size.height

        return CGRect(x: x, y: y, width: width, height: height)
    }
}

// MARK: - Corner brackets

struct CornerBrackets: View {
    let rect: CGRect
    let color: Color
    private let armLength: CGFloat = 22
    private let lineWidth: CGFloat = 3

    var body: some View {
        ZStack {
            bracket(corner: CGPoint(x: rect.minX, y: rect.minY), h:  1, v:  1)
            bracket(corner: CGPoint(x: rect.maxX, y: rect.minY), h: -1, v:  1)
            bracket(corner: CGPoint(x: rect.minX, y: rect.maxY), h:  1, v: -1)
            bracket(corner: CGPoint(x: rect.maxX, y: rect.maxY), h: -1, v: -1)
        }
    }

    private func bracket(corner: CGPoint, h: CGFloat, v: CGFloat) -> some View {
        Path { p in
            p.move(to: CGPoint(x: corner.x + h * armLength, y: corner.y))
            p.addLine(to: corner)
            p.addLine(to: CGPoint(x: corner.x, y: corner.y + v * armLength))
        }
        .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round))
    }
}

// MARK: - Capture progress arc

struct CaptureProgressArc: View {
    let progress: CGFloat
    let isSending: Bool

    private let radius: CGFloat = 18
    private let lineWidth: CGFloat = 3

    var body: some View {
        ZStack {
            // Track
            Circle()
                .stroke(Color.white.opacity(0.2), lineWidth: lineWidth)
                .frame(width: radius * 2, height: radius * 2)

            // Fill arc
            Circle()
                .trim(from: 0, to: progress)
                .stroke(isSending ? Color.yellow : Color.green,
                        style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: radius * 2, height: radius * 2)
                .animation(.easeInOut(duration: 0.12), value: progress)

            // Center dot
            Circle()
                .fill(isSending ? Color.yellow : Color.green)
                .frame(width: 6, height: 6)
        }
    }
}

// MARK: - Status banner

struct ScanStatusBanner: View {
    let state: CardDetectionState
    let isSending: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(iconColor)
                .symbolEffect(.pulse, isActive: state.phase == .locking)
            Text(message)
                .font(.subheadline.weight(.medium))
                .foregroundColor(.white)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .animation(.easeInOut(duration: 0.15), value: state.phase == .locking)
    }

    private var icon: String {
        if isSending                         { return "arrow.up.circle.fill" }
        if state.phase == .capturing         { return "camera.fill" }
        if state.phase == .locking           { return "scope" }
        if state.phase == .detected          { return "rectangle.dashed" }
        return "viewfinder"
    }

    private var iconColor: Color {
        if isSending             { return .yellow }
        if state.phase == .capturing { return .yellow }
        if state.phase == .locking   { return .green }
        if state.phase == .detected  { return .orange }
        return .white
    }

    private var message: String {
        if isSending                         { return "Identifying card…" }
        if state.phase == .capturing         { return "Capturing…" }
        if state.phase == .locking           { return "Hold steady…" }
        if state.phase == .detected          { return "Card found — keep still" }
        return "Point camera at a football card"
    }
}
