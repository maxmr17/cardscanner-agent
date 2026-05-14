import Foundation
import SwiftUI

@MainActor
final class AuthStore: ObservableObject {
    @Published var currentUser: User?
    @Published var isAuthenticated = false

    private let tokenKey = "auth_token"

    init() {
        if let token = UserDefaults.standard.string(forKey: tokenKey) {
            APIService.shared.setToken(token)
            Task { await verifyToken() }
        }
    }

    private func verifyToken() async {
        do {
            let wrapper = try await APIService.shared.me()
            currentUser = wrapper.user
            isAuthenticated = true
        } catch {
            logout()
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
        UserDefaults.standard.set(response.token, forKey: tokenKey)
        APIService.shared.setToken(response.token)
        currentUser = response.user
        isAuthenticated = true
    }

    func logout() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
        APIService.shared.setToken(nil)
        currentUser = nil
        isAuthenticated = false
    }
}
