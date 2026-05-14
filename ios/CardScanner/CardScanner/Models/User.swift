import Foundation

struct User: Codable, Identifiable {
    let id: String
    let email: String?
    let username: String
    let displayName: String?
    let avatarUrl: String?
    let bio: String?
    let isPublic: Bool?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, email, username
        case displayName = "display_name"
        case avatarUrl   = "avatar_url"
        case bio
        case isPublic    = "is_public"
        case createdAt   = "created_at"
    }

    var name: String { displayName ?? username }
}

struct AuthResponse: Codable {
    let token: String
    let user: User
}

struct UserProfile: Codable, Identifiable {
    let id: String
    let username: String
    let displayName: String?
    let avatarUrl: String?
    let bio: String?
    let isPublic: Bool?
    let followerCount: Int
    let followingCount: Int
    let cardCount: Int
    let isFollowing: Bool
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, username
        case displayName    = "display_name"
        case avatarUrl      = "avatar_url"
        case bio
        case isPublic       = "is_public"
        case followerCount  = "follower_count"
        case followingCount = "following_count"
        case cardCount      = "card_count"
        case isFollowing    = "is_following"
        case createdAt      = "created_at"
    }

    var name: String { displayName ?? username }
}
