import SwiftUI

struct AuthView: View {
    @State private var mode: Mode = .login

    enum Mode { case login, signup }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color.black, Color(red: 0.1, green: 0.05, blue: 0)],
                    startPoint: .top, endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack(spacing: 32) {
                    // Logo
                    VStack(spacing: 8) {
                        Image(systemName: "rectangle.stack.badge.plus")
                            .font(.system(size: 52))
                            .foregroundColor(.orange)
                        Text("CardScanner")
                            .font(.largeTitle.bold())
                            .foregroundColor(.white)
                        Text("Scan · Identify · Collect")
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.6))
                    }
                    .padding(.top, 40)

                    // Form
                    if mode == .login {
                        LoginForm()
                            .transition(.asymmetric(insertion: .move(edge: .trailing), removal: .move(edge: .leading)))
                    } else {
                        SignUpForm()
                            .transition(.asymmetric(insertion: .move(edge: .trailing), removal: .move(edge: .leading)))
                    }

                    // Toggle
                    Button {
                        withAnimation { mode = mode == .login ? .signup : .login }
                    } label: {
                        Text(mode == .login ? "New here? Create an account" : "Already have an account? Log in")
                            .font(.subheadline)
                            .foregroundColor(.orange)
                    }

                    Spacer()
                }
                .padding(.horizontal, 24)
            }
        }
    }
}
