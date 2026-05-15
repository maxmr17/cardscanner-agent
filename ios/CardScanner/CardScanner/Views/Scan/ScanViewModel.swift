import Foundation
import UIKit

@MainActor
final class ScanViewModel: ObservableObject {
    @Published var detectionState: CardDetectionState = .init(phase: .searching,
                                                               normalizedRect: nil,
                                                               captureProgress: 0,
                                                               blurScore: 0)
    @Published var capturedSession: ScanSession?
    private var lastCapturedImage: UIImage?
    @Published var isSending = false    // waiting for API response
    @Published var showError  = false
    @Published var errorMessage = ""
    @Published var torchOn = false

    let cameraManager = CameraManager()

    private var scanTask: Task<Void, Never>?
    private let encodingQueue = DispatchQueue(label: "scan.encoding", qos: .userInitiated)

    init() {
        cameraManager.delegate = self
    }

    // MARK: - Convenience accessors for the view

    var cardDetected:  Bool  { detectionState.phase != .searching }
    var captureReady:  Bool  { detectionState.phase == .locking || detectionState.phase == .capturing }
    var isCapturing:   Bool  { detectionState.phase == .capturing || isSending }
    var captureProgress: Float { detectionState.captureProgress }

    // MARK: - Camera lifecycle

    func startCamera() {
        AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
            DispatchQueue.main.async {
                guard granted else {
                    self?.showError(message: "Camera access is required to scan cards. Enable it in Settings.")
                    return
                }
                self?.cameraManager.configure()
            }
        }
    }

    func stopCamera() {
        cameraManager.stop()
        scanTask?.cancel()
    }

    func manualCapture() {
        cameraManager.triggerManualCapture()
    }

    func toggleTorch() {
        torchOn.toggle()
        cameraManager.setTorch(on: torchOn)
    }

    // MARK: - Image processing and API call
    //
    // JPEG encoding is moved off the main thread. The image passed here is the
    // perspective-corrected card image from CameraManager, ready to send directly.

    private func processCapture(_ image: UIImage) {
        guard !isSending else { return }
        isSending = true
        lastCapturedImage = image
        scanTask?.cancel()

        scanTask = Task {
            // Encode JPEG on a background queue so we don't block the main thread.
            let imageData: Data? = await withCheckedContinuation { continuation in
                encodingQueue.async {
                    continuation.resume(returning: image.jpegData(compressionQuality: 0.92))
                }
            }

            guard !Task.isCancelled else { isSending = false; return }
            guard let data = imageData else {
                showError(message: "Failed to encode captured image.")
                isSending = false
                return
            }

            do {
                let result = try await APIService.shared.scanCard(imageData: data)
                capturedSession = ScanSession(result: result, capturedImage: lastCapturedImage)
            } catch {
                showError(message: error.localizedDescription)
            }
            isSending = false
        }
    }

    private func showError(message: String) {
        errorMessage = message
        showError = true
    }
}

// MARK: - CameraManagerDelegate

extension ScanViewModel: CameraManagerDelegate {
    nonisolated func cameraManager(_ manager: CameraManager, didCaptureCard image: UIImage) {
        Task { @MainActor in self.processCapture(image) }
    }

    nonisolated func cameraManager(_ manager: CameraManager, detectionDidUpdate state: CardDetectionState) {
        Task { @MainActor in self.detectionState = state }
    }
}
