import Foundation
import SwiftUI

@MainActor
final class AuthStore: ObservableObject {
    @Published var currentUser: User?
    @Published var isAuthenticated = false
    @Published var isVerifying = true

    private let tokenKey = "auth_token"
    private var verifyTask: Task<Void, Never>?

    init() {
        if let token = KeychainHelper.read(key: tokenKey) {
            APIService.shared.setToken(token)
            verifyTask = Task { await verifyToken() }
        } else {
            isVerifying = false
        }
    }

    private func verifyToken() async {
        defer { isVerifying = false }
        do {
            let wrapper = try await APIService.shared.me()
            currentUser = wrapper.user
            isAuthenticated = true
        } catch {
            clearSession()
        }
    }

    func login(email: String, password: String) async throws {
        let response = try await APIService.shared.login(email: email, password: password)
        persist(response)
    }

    func signup(email: String, password: String, username: String, displayName: String?) async throws {
        let response = try await APIService.shared.signup(email: email, password: password, username: username, displayName: displayName)
        persist(response)
    }

    private func persist(_ response: AuthResponse) {
        KeychainHelper.save(response.token, key: tokenKey)
        APIService.shared.setToken(response.token)
        currentUser = response.user
        isAuthenticated = true
        isVerifying = false
    }

    func logout() {
        verifyTask?.cancel()
        verifyTask = nil
        clearSession()
    }

    private func clearSession() {
        KeychainHelper.delete(key: tokenKey)
        APIService.shared.setToken(nil)
        currentUser = nil
        isAuthenticated = false
    }
}
