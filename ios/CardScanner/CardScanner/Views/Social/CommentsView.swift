import SwiftUI

struct CommentsView: View {
    let post: Post
    @StateObject private var viewModel: CommentsViewModel
    @State private var newComment = ""
    @FocusState private var focused: Bool

    init(post: Post) {
        self.post = post
        _viewModel = StateObject(wrappedValue: CommentsViewModel(postId: post.id))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if viewModel.isLoading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.comments.isEmpty {
                    Text("No comments yet. Be the first!")
                        .foregroundColor(.secondary).frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(viewModel.comments) { comment in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(comment.authorName).font(.subheadline.weight(.semibold))
                                Spacer()
                                if let date = comment.createdAt {
                                    Text(date.relativeFormatted).font(.caption).foregroundColor(.secondary)
                                }
                            }
                            Text(comment.content).font(.subheadline)
                        }
                        .padding(.vertical, 4)
                    }
                    .listStyle(.plain)
                }

                // Input
                Divider()
                HStack(spacing: 10) {
                    TextField("Add a comment…", text: $newComment, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(1...4)
                        .focused($focused)
                    Button("Post") {
                        Task { await submit() }
                    }
                    .fontWeight(.semibold)
                    .disabled(newComment.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(Color(.systemBackground))
            }
            .navigationTitle("Comments")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { viewModel.load() }
        }
    }

    private func submit() async {
        let text = newComment.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        newComment = ""
        focused = false
        await viewModel.addComment(text)
    }
}

@MainActor
final class CommentsViewModel: ObservableObject {
    @Published var comments: [Comment] = []
    @Published var isLoading = false
    private let postId: String

    init(postId: String) { self.postId = postId }

    func load() {
        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                let resp = try await APIService.shared.comments(postId: postId)
                comments = resp.comments
            } catch {}
        }
    }

    func addComment(_ content: String) async {
        do {
            let resp = try await APIService.shared.addComment(postId: postId, content: content)
            comments.append(resp.comment)
        } catch {}
    }
}
