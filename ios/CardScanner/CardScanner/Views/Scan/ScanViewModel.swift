import Foundation
import UIKit
import Combine

@MainActor
final class ScanViewModel: ObservableObject {
    @Published var cardDetected = false
    @Published var captureReady = false
    @Published var isCapturing = false
    @Published var detectedRect: CGRect?
    @Published var capturedResult: ScanResult?
    @Published var showError = false
    @Published var errorMessage = ""

    let cameraManager = CameraManager()

    private var scanTask: Task<Void, Never>?

    init() {
        cameraManager.delegate = self
    }

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
        cameraManager.capturePhoto()
    }

    private func processCapture(_ image: UIImage) {
        isCapturing = true
        scanTask = Task {
            do {
                guard let data = image.jpegData(compressionQuality: 0.92) else {
                    showError(message: "Failed to encode image")
                    return
                }
                let result = try await APIService.shared.scanCard(imageData: data)
                capturedResult = result
            } catch {
                showError(message: error.localizedDescription)
            }
            isCapturing = false
        }
    }

    private func showError(message: String) {
        errorMessage = message
        showError = true
    }
}

extension ScanViewModel: CameraManagerDelegate {
    nonisolated func cameraManager(_ manager: CameraManager, didCaptureImage image: UIImage) {
        Task { @MainActor in
            self.processCapture(image)
        }
    }

    nonisolated func cameraManager(_ manager: CameraManager, didDetectCard rect: CGRect?, isReady: Bool) {
        Task { @MainActor in
            self.detectedRect = rect
            self.cardDetected = rect != nil
            self.captureReady = isReady
            self.isCapturing = manager.isCapturing
        }
    }
}
