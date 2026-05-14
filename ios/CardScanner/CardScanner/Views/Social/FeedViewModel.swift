import Foundation

@MainActor
final class FeedViewModel: ObservableObject {
    @Published var posts: [Post] = []
    @Published var isLoading = false
    @Published var selectedPost: Post?

    private var page = 1
    private var hasNextPage = true

    var hasMore: Bool { hasNextPage }

    func refresh() {
        page = 1; posts = []
        Task { await load() }
    }

    func refreshAsync() async {
        page = 1; posts = []
        await load()
    }

    func loadMore() {
        guard hasMore, !isLoading else { return }
        page += 1
        Task { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response = try await APIService.shared.feed(page: page)
            if page == 1 { posts = response.posts } else { posts += response.posts }
            hasNextPage = response.posts.count == 20
        } catch { print("Feed error:", error) }
    }

    func toggleLike(_ post: Post) async {
        do {
            if post.likedByMe {
                try await APIService.shared.unlikePost(id: post.id)
            } else {
                try await APIService.shared.likePost(id: post.id)
            }
        } catch { print("Like error:", error) }
    }
}
