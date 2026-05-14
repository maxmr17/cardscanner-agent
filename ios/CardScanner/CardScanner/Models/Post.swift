import Foundation

struct Post: Codable, Identifiable {
    let id: String
    let caption: String?
    let createdAt: Date?

    let authorId: String?
    let username: String?
    let displayName: String?
    let avatarUrl: String?

    let imageUrl: String?
    let condition: String?
    let playerName: String?
    let team: String?
    let year: Int?
    let setName: String?
    let variant: String?
    let midPrice: Double?

    let likeCount: Int
    let commentCount: Int
    let likedByMe: Bool

    enum CodingKeys: String, CodingKey {
        case id, caption
        case createdAt      = "created_at"
        case authorId       = "author_id"
        case username
        case displayName    = "display_name"
        case avatarUrl      = "avatar_url"
        case imageUrl       = "image_url"
        case condition
        case playerName     = "player_name"
        case team, year
        case setName        = "set_name"
        case variant
        case midPrice       = "mid_price"
        case likeCount      = "like_count"
        case commentCount   = "comment_count"
        case likedByMe      = "liked_by_me"
    }

    var authorName: String { displayName ?? username ?? "Unknown" }

    var midPriceFormatted: String? {
        guard let price = midPrice else { return nil }
        return String(format: "$%.2f", price)
    }
}

struct Comment: Codable, Identifiable {
    let id: String
    let content: String
    let createdAt: Date?
    let userId: String?
    let username: String?
    let displayName: String?
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, content
        case createdAt   = "created_at"
        case userId      = "user_id"
        case username
        case displayName = "display_name"
        case avatarUrl   = "avatar_url"
    }

    var authorName: String { displayName ?? username ?? "Unknown" }
}
