import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authStore: AuthStore
    @StateObject private var viewModel = ProfileViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if let user = authStore.currentUser {
                    ScrollView {
                        VStack(spacing: 0) {
                            ProfileHeader(user: user, stats: viewModel.stats)
                            Divider()
                            ProfileCollectionGrid(items: viewModel.recentItems)
                        }
                    }
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Profile")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button(role: .destructive) { authStore.logout() } label: {
                            Label("Sign Out", systemImage: "arrow.right.square")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    NavigationLink(destination: UserSearchView()) {
                        Image(systemName: "person.badge.plus")
                    }
                }
            }
            .onAppear { viewModel.load() }
        }
    }
}

struct ProfileHeader: View {
    let user: User
    let stats: CollectionStats?

    var body: some View {
        VStack(spacing: 12) {
            AvatarView(url: user.avatarUrl, size: 72)
            Text(user.name).font(.title2.bold())
            Text("@\(user.username)").font(.subheadline).foregroundColor(.secondary)
            if let bio = user.bio { Text(bio).font(.subheadline).multilineTextAlignment(.center).padding(.horizontal) }

            if let stats = stats {
                HStack(spacing: 0) {
                    ProfileStat(label: "Cards", value: "\(stats.totalCards)")
                    Divider().frame(height: 30)
                    ProfileStat(label: "Players", value: "\(stats.uniquePlayers)")
                    Divider().frame(height: 30)
                    if let val = stats.portfolioValue {
                        ProfileStat(label: "Est. Value", value: String(format: "$%.0f", val))
                    }
                }
                .padding(.vertical, 6)
            }
        }
        .padding()
    }
}

private struct ProfileStat: View {
    let label: String; let value: String
    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.headline)
            Text(label).font(.caption2).foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct ProfileCollectionGrid: View {
    let items: [CollectionItem]
    let columns = [GridItem(.adaptive(minimum: 100), spacing: 2)]

    var body: some View {
        if items.isEmpty {
            Text("No cards in collection yet")
                .foregroundColor(.secondary)
                .padding(40)
        } else {
            LazyVGrid(columns: columns, spacing: 2) {
                ForEach(items) { item in
                    NavigationLink(destination: CardDetailView(item: item)) {
                        AsyncImage(url: URL(string: item.imageUrl ?? "")) { phase in
                            switch phase {
                            case .success(let img): img.resizable().scaledToFill()
                            default: Rectangle().fill(Color.gray.opacity(0.2))
                            }
                        }
                        .frame(height: 120)
                        .clipped()
                    }
                }
            }
        }
    }
}

@MainActor
final class ProfileViewModel: ObservableObject {
    @Published var stats: CollectionStats?
    @Published var recentItems: [CollectionItem] = []

    func load() {
        Task {
            do {
                async let statsResult = APIService.shared.collectionStats()
                async let collectionResult = APIService.shared.collection(page: 1, sort: "newest")
                stats = try await statsResult.stats
                recentItems = try await collectionResult.items
            } catch {}
        }
    }
}
