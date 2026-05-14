import SwiftUI

struct UserSearchView: View {
    @State private var query = ""
    @State private var users: [User] = []
    @State private var isSearching = false

    var body: some View {
        List(users) { user in
            NavigationLink(destination: OtherProfileView(userId: user.id)) {
                HStack(spacing: 12) {
                    AvatarView(url: user.avatarUrl, size: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(user.name).font(.subheadline.weight(.semibold))
                        Text("@\(user.username)").font(.caption).foregroundColor(.secondary)
                    }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Find Collectors")
        .searchable(text: $query, prompt: "Search by username")
        .onChange(of: query) { _, new in
            guard new.count >= 2 else { users = []; return }
            isSearching = true
            Task {
                do {
                    let resp = try await APIService.shared.searchUsers(query: new)
                    users = resp.users
                } catch {}
                isSearching = false
            }
        }
        .overlay {
            if isSearching { ProgressView() }
            else if users.isEmpty && query.count >= 2 {
                Text("No users found").foregroundColor(.secondary)
            }
        }
    }
}

struct OtherProfileView: View {
    let userId: String
    @State private var profile: UserProfile?
    @State private var items: [CollectionItem] = []
    @State private var isFollowing = false
    @State private var isLoading = true

    var body: some View {
        ScrollView {
            if isLoading {
                ProgressView().padding(40)
            } else if let profile {
                VStack(spacing: 0) {
                    // Header
                    VStack(spacing: 12) {
                        AvatarView(url: profile.avatarUrl, size: 72)
                        Text(profile.name).font(.title2.bold())
                        Text("@\(profile.username)").font(.subheadline).foregroundColor(.secondary)
                        if let bio = profile.bio { Text(bio).font(.subheadline).multilineTextAlignment(.center) }

                        HStack(spacing: 24) {
                            VStack { Text("\(profile.cardCount)").font(.headline); Text("Cards").font(.caption).foregroundColor(.secondary) }
                            VStack { Text("\(profile.followerCount)").font(.headline); Text("Followers").font(.caption).foregroundColor(.secondary) }
                            VStack { Text("\(profile.followingCount)").font(.headline); Text("Following").font(.caption).foregroundColor(.secondary) }
                        }

                        Button {
                            Task { await toggleFollow() }
                        } label: {
                            Text(isFollowing ? "Unfollow" : "Follow")
                                .frame(width: 120)
                                .padding(.vertical, 8)
                                .background(isFollowing ? Color(.systemGray5) : Color.orange)
                                .foregroundColor(isFollowing ? .primary : .white)
                                .clipShape(Capsule())
                                .fontWeight(.semibold)
                        }
                    }
                    .padding()

                    Divider()

                    // Their collection
                    let columns = [GridItem(.adaptive(minimum: 100), spacing: 2)]
                    LazyVGrid(columns: columns, spacing: 2) {
                        ForEach(items) { item in
                            AsyncImage(url: URL(string: item.imageUrl ?? "")) { phase in
                                switch phase {
                                case .success(let img): img.resizable().scaledToFill()
                                default: Rectangle().fill(Color.gray.opacity(0.2))
                                }
                            }
                            .frame(height: 120).clipped()
                        }
                    }
                }
            }
        }
        .navigationTitle(profile?.username ?? "Profile")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadProfile() }
    }

    private func loadProfile() async {
        defer { isLoading = false }
        do {
            async let profileResult = APIService.shared.userProfile(id: userId)
            async let collectionResult = APIService.shared.collection(page: 1)
            profile = try await profileResult.profile
            isFollowing = profile?.isFollowing ?? false
            // Note: ideally load their collection separately; using own endpoint as placeholder
            items = (try? await collectionResult.items) ?? []
        } catch {}
    }

    private func toggleFollow() async {
        do {
            if isFollowing {
                try await APIService.shared.unfollowUser(id: userId)
            } else {
                try await APIService.shared.followUser(id: userId)
            }
            isFollowing.toggle()
        } catch {}
    }
}
