import SwiftUI

struct LoginForm: View {
    @EnvironmentObject var authStore: AuthStore
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 16) {
            TextField("Email", text: $email)
                .authFieldStyle()
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
                .autocapitalization(.none)

            SecureField("Password", text: $password)
                .authFieldStyle()
                .textContentType(.password)

            if let error { ErrorBanner(message: error) }

            Button {
                Task { await login() }
            } label: {
                Text(isLoading ? "Logging in…" : "Log In")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.orange)
                    .foregroundColor(.black)
                    .fontWeight(.semibold)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(isLoading || email.isEmpty || password.isEmpty)
            .opacity(isLoading || email.isEmpty || password.isEmpty ? 0.7 : 1)
        }
    }

    private func login() async {
        isLoading = true
        error = nil
        do {
            try await authStore.login(email: email, password: password)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct SignUpForm: View {
    @EnvironmentObject var authStore: AuthStore
    @State private var email = ""
    @State private var password = ""
    @State private var username = ""
    @State private var displayName = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 16) {
            TextField("Display Name", text: $displayName)
                .authFieldStyle()
                .textContentType(.name)

            TextField("Username", text: $username)
                .authFieldStyle()
                .autocapitalization(.none)

            TextField("Email", text: $email)
                .authFieldStyle()
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
                .autocapitalization(.none)

            SecureField("Password (8+ characters)", text: $password)
                .authFieldStyle()
                .textContentType(.newPassword)

            if let error { ErrorBanner(message: error) }

            Button {
                Task { await signup() }
            } label: {
                Text(isLoading ? "Creating account…" : "Create Account")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.orange)
                    .foregroundColor(.black)
                    .fontWeight(.semibold)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(isLoading || email.isEmpty || password.isEmpty || username.isEmpty)
        }
    }

    private func signup() async {
        isLoading = true
        error = nil
        do {
            try await authStore.signup(
                email: email, password: password, username: username,
                displayName: displayName.isEmpty ? nil : displayName
            )
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Shared styles

extension View {
    func authFieldStyle() -> some View {
        self
            .padding()
            .background(Color.white.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .foregroundColor(.white)
    }
}

struct ErrorBanner: View {
    let message: String
    var body: some View {
        Text(message)
            .font(.caption)
            .foregroundColor(.white)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.red.opacity(0.8))
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
