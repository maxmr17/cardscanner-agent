import SwiftUI
import AVFoundation

struct ScanView: View {
    @StateObject private var viewModel = ScanViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                // Camera preview
                CameraPreviewView(session: viewModel.cameraManager.session)
                    .ignoresSafeArea()

                // Card guide overlay
                CardGuideOverlay(
                    detectedRect: viewModel.detectedRect,
                    isReady: viewModel.captureReady
                )

                // Status UI
                VStack {
                    Spacer()

                    ScanStatusBanner(
                        cardDetected: viewModel.cardDetected,
                        captureReady: viewModel.captureReady,
                        isCapturing: viewModel.isCapturing
                    )
                    .padding(.horizontal)
                    .padding(.bottom, 40)
                }
            }
            .navigationTitle("Scan Card")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Manual") { viewModel.manualCapture() }
                        .foregroundColor(.white)
                        .disabled(viewModel.isCapturing)
                }
            }
            .onAppear { viewModel.startCamera() }
            .onDisappear { viewModel.stopCamera() }
            .sheet(item: $viewModel.capturedResult) { result in
                ScanResultSheet(result: result)
            }
            .alert("Scan Error", isPresented: $viewModel.showError) {
                Button("OK") {}
            } message: {
                Text(viewModel.errorMessage)
            }
        }
    }
}

// MARK: - Camera preview (UIViewRepresentable)

struct CameraPreviewView: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewUIView {
        let view = PreviewUIView()
        view.session = session
        return view
    }

    func updateUIView(_ uiView: PreviewUIView, context: Context) {}
}

final class PreviewUIView: UIView {
    var session: AVCaptureSession? {
        didSet {
            guard let session else { return }
            (layer as! AVCaptureVideoPreviewLayer).session = session
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

// MARK: - Card guide overlay

struct CardGuideOverlay: View {
    let detectedRect: CGRect?
    let isReady: Bool

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Dimmed border around the guide area
                Rectangle()
                    .fill(Color.black.opacity(0.35))
                    .mask(
                        Rectangle().overlay(
                            guideRect(in: geo.size)
                                .blendMode(.destinationOut)
                        )
                    )

                // Guide frame
                guideRect(in: geo.size)
                    .stroke(isReady ? Color.green : Color.white, lineWidth: isReady ? 3 : 1.5)
                    .animation(.easeInOut(duration: 0.2), value: isReady)

                // Detected card highlight
                if let rect = detectedRect {
                    let scaled = CGRect(
                        x: rect.minX * geo.size.width,
                        y: rect.minY * geo.size.height,
                        width: rect.width * geo.size.width,
                        height: rect.height * geo.size.height
                    )
                    Rectangle()
                        .stroke(Color.orange, lineWidth: 2)
                        .frame(width: scaled.width, height: scaled.height)
                        .position(x: scaled.midX, y: scaled.midY)
                        .animation(.easeInOut(duration: 0.1), value: rect)
                }

                // Corner brackets
                CornerBrackets(rect: guideRect(in: geo.size).path(in: geo.frame(in: .local)).boundingRect,
                               color: isReady ? .green : .white)
            }
        }
    }

    private func guideRect(in size: CGSize) -> RoundedRectangle {
        RoundedRectangle(cornerRadius: 8)
    }

    // Center guide that's card-proportioned (2.5:3.5)
    private func guideFrame(in size: CGSize) -> CGRect {
        let width = size.width * 0.78
        let height = width * (3.5 / 2.5)
        let x = (size.width - width) / 2
        let y = (size.height - height) / 2
        return CGRect(x: x, y: y, width: width, height: height)
    }
}

struct CornerBrackets: View {
    let rect: CGRect
    let color: Color
    let length: CGFloat = 20
    let lineWidth: CGFloat = 3

    var body: some View {
        ZStack {
            // TL
            bracket(at: CGPoint(x: rect.minX, y: rect.minY), hDir: 1, vDir: 1)
            // TR
            bracket(at: CGPoint(x: rect.maxX, y: rect.minY), hDir: -1, vDir: 1)
            // BL
            bracket(at: CGPoint(x: rect.minX, y: rect.maxY), hDir: 1, vDir: -1)
            // BR
            bracket(at: CGPoint(x: rect.maxX, y: rect.maxY), hDir: -1, vDir: -1)
        }
    }

    @ViewBuilder
    private func bracket(at point: CGPoint, hDir: CGFloat, vDir: CGFloat) -> some View {
        Path { p in
            p.move(to: CGPoint(x: point.x + hDir * length, y: point.y))
            p.addLine(to: point)
            p.addLine(to: CGPoint(x: point.x, y: point.y + vDir * length))
        }
        .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
    }
}

// MARK: - Status banner

struct ScanStatusBanner: View {
    let cardDetected: Bool
    let captureReady: Bool
    let isCapturing: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(iconColor)
            Text(message)
                .font(.subheadline.weight(.medium))
                .foregroundColor(.white)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .animation(.easeInOut, value: captureReady)
    }

    private var icon: String {
        if isCapturing   { return "camera.fill" }
        if captureReady  { return "checkmark.circle.fill" }
        if cardDetected  { return "rectangle.dashed" }
        return "viewfinder"
    }

    private var iconColor: Color {
        if isCapturing  { return .yellow }
        if captureReady { return .green }
        if cardDetected { return .orange }
        return .white
    }

    private var message: String {
        if isCapturing  { return "Capturing…" }
        if captureReady { return "Card in position — capturing" }
        if cardDetected { return "Hold steady…" }
        return "Point camera at a football card"
    }
}
