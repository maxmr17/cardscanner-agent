import SwiftUI

struct FeedView: View {
    @StateObject private var viewModel = FeedViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.posts.isEmpty {
                    ProgressView("Loading feed…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.posts.isEmpty {
                    EmptyFeedView()
                } else {
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(viewModel.posts) { post in
                                PostCard(post: post, onLike: {
                                    Task { await viewModel.toggleLike(post) }
                                }, onComment: {
                                    viewModel.selectedPost = post
                                })
                                Divider()
                            }
                            if viewModel.hasMore {
                                ProgressView().padding().onAppear { viewModel.loadMore() }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Feed")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { viewModel.refresh() } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .refreshable { await viewModel.refreshAsync() }
            .onAppear { if viewModel.posts.isEmpty { viewModel.refresh() } }
            .sheet(item: $viewModel.selectedPost) { post in
                CommentsView(post: post)
            }
        }
    }
}

// MARK: - Post card

struct PostCard: View {
    let post: Post
    let onLike: () -> Void
    let onComment: () -> Void
    @State private var liked: Bool
    @State private var likeCount: Int

    init(post: Post, onLike: @escaping () -> Void, onComment: @escaping () -> Void) {
        self.post = post
        self.onLike = onLike
        self.onComment = onComment
        _liked = State(initialValue: post.likedByMe)
        _likeCount = State(initialValue: post.likeCount)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Author header
            HStack(spacing: 10) {
                AvatarView(url: post.avatarUrl, size: 36)
                VStack(alignment: .leading, spacing: 1) {
                    Text(post.authorName).font(.subheadline.weight(.semibold))
                    if let time = post.createdAt { Text(time.relativeFormatted).font(.caption).foregroundColor(.secondary) }
                }
                Spacer()
            }
            .padding(.horizontal, 16).padding(.vertical, 12)

            // Card image
            AsyncImage(url: URL(string: post.imageUrl ?? "")) { phase in
                switch phase {
                case .success(let img): img.resizable().scaledToFit()
                default: Rectangle().fill(Color.gray.opacity(0.1)).frame(height: 200)
                    .overlay(Image(systemName: "photo").foregroundColor(.gray))
                }
            }
            .frame(maxWidth: .infinity)

            // Card info
            VStack(alignment: .leading, spacing: 4) {
                if let player = post.playerName {
                    HStack {
                        Text(player).font(.subheadline.weight(.semibold))
                        Spacer()
                        if let price = post.midPriceFormatted { Text(price).font(.subheadline).foregroundColor(.green) }
                    }
                }
                HStack(spacing: 6) {
                    if let year = post.year { Text(String(year)).font(.caption).foregroundColor(.secondary) }
                    if let set = post.setName { Text(set).font(.caption).foregroundColor(.secondary) }
                    if let v = post.variant, v != "Base" { Text(v).font(.caption).foregroundColor(.orange) }
                }
                if let caption = post.caption, !caption.isEmpty {
                    Text(caption).font(.subheadline).padding(.top, 4)
                }
            }
            .padding(.horizontal, 16).padding(.top, 10)

            // Action row
            HStack(spacing: 20) {
                Button {
                    liked.toggle()
                    likeCount += liked ? 1 : -1
                    onLike()
                } label: {
                    Label("\(likeCount)", systemImage: liked ? "heart.fill" : "heart")
                        .foregroundColor(liked ? .red : .secondary)
                }

                Button {
                    onComment()
                } label: {
                    Label("\(post.commentCount)", systemImage: "bubble.right")
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
            .font(.subheadline)
            .padding(.horizontal, 16).padding(.vertical, 10)
        }
    }
}

// MARK: - Helpers

struct AvatarView: View {
    let url: String?
    let size: CGFloat
    var body: some View {
        AsyncImage(url: URL(string: url ?? "")) { phase in
            if case .success(let img) = phase { img.resizable().scaledToFill() }
            else { Image(systemName: "person.fill").font(.title3).foregroundColor(.white) }
        }
        .frame(width: size, height: size)
        .background(Color.orange.opacity(0.7))
        .clipShape(Circle())
    }
}

struct EmptyFeedView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "newspaper")
                .font(.system(size: 64)).foregroundColor(.orange)
            Text("Your feed is empty").font(.title2.bold())
            Text("Follow collectors to see their cards here")
                .font(.subheadline).foregroundColor(.secondary)
                .multilineTextAlignment(.center).padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

extension Date {
    var relativeFormatted: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: self, relativeTo: Date())
    }
}
