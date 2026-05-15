import Foundation
import UIKit

enum APIError: LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case serverError(String)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidURL:           return "Invalid URL"
        case .noData:               return "No data received"
        case .decodingError(let e): return "Parsing error: \(e.localizedDescription)"
        case .serverError(let msg): return msg
        case .unauthorized:         return "Please log in again"
        }
    }
}

final class APIService {
    static let shared = APIService()

    private let baseURL: String
    private var authToken: String?

    private let encoder = JSONEncoder()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    private init() {
        baseURL = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
            ?? "http://localhost:3000"
    }

    func setToken(_ token: String?) { authToken = token }

    // MARK: - Generic request (returns decoded body)

    private func request<T: Decodable>(
        path: String,
        method: String = "GET",
        body: Encodable? = nil
    ) async throws -> T {
        let req = try buildRequest(path: path, method: method, body: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        try validate(response: response, data: data)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Void request (no response body — handles 204)

    private func voidRequest(path: String, method: String, body: Encodable? = nil) async throws {
        let req = try buildRequest(path: path, method: method, body: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        try validate(response: response, data: data)
    }

    // MARK: - Helpers

    private func buildRequest(path: String, method: String, body: Encodable?) throws -> URLRequest {
        guard let url = URL(string: baseURL + path) else { throw APIError.invalidURL }
        var req = URLRequest(url: url, timeoutInterval: 30)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            req.httpBody = try encoder.encode(body)
        }
        return req
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw APIError.noData }
        if http.statusCode == 401 { throw APIError.unauthorized }
        if !(200..<300).contains(http.statusCode) {
            let msg = (try? decoder.decode([String: String].self, from: data))?["error"]
                ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            throw APIError.serverError(msg)
        }
    }

    // MARK: - Auth

    struct LoginBody: Encodable { let email: String; let password: String }
    struct SignupBody: Encodable { let email: String; let password: String; let username: String; let display_name: String? }

    func login(email: String, password: String) async throws -> AuthResponse {
        try await request(path: "/auth/login", method: "POST", body: LoginBody(email: email, password: password))
    }

    func signup(email: String, password: String, username: String, displayName: String?) async throws -> AuthResponse {
        try await request(path: "/auth/signup", method: "POST", body: SignupBody(email: email, password: password, username: username, display_name: displayName))
    }

    func me() async throws -> UserWrapper { try await request(path: "/auth/me") }

    // MARK: - Card scanning

    func scanCard(imageData: Data) async throws -> ScanResult {
        guard let url = URL(string: baseURL + "/cards/scan") else { throw APIError.invalidURL }

        var req = URLRequest(url: url, timeoutInterval: 60)
        req.httpMethod = "POST"
        if let token = authToken { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        let boundary = UUID().uuidString
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"image\"; filename=\"card.jpg\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        req.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: req)
        try validate(response: response, data: data)
        do {
            return try decoder.decode(ScanResult.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Collection

    func collection(page: Int = 1, sort: String = "newest") async throws -> CollectionResponse {
        try await request(path: "/collection?page=\(page)&sort=\(sort)&limit=30")
    }

    func collection(userId: String) async throws -> OtherCollectionResponse {
        try await request(path: "/collection/\(userId)")
    }

    func collectionStats() async throws -> StatsWrapper {
        try await request(path: "/collection/stats/summary")
    }

    func updateItem(id: String, condition: String?, notes: String?, forSale: Bool?, askingPrice: Double?) async throws -> ItemWrapper {
        struct Body: Encodable { let condition: String?; let notes: String?; let for_sale: Bool?; let asking_price: Double? }
        return try await request(path: "/collection/items/\(id)", method: "PATCH",
                                  body: Body(condition: condition, notes: notes, for_sale: forSale, asking_price: askingPrice))
    }

    func deleteItem(id: String) async throws {
        try await voidRequest(path: "/collection/items/\(id)", method: "DELETE")
    }

    // MARK: - Social

    func feed(page: Int = 1) async throws -> FeedResponse {
        try await request(path: "/social/feed?page=\(page)")
    }

    func createPost(collectionItemId: String, caption: String?) async throws -> PostWrapper {
        struct Body: Encodable { let collection_item_id: String; let caption: String? }
        return try await request(path: "/social/posts", method: "POST",
                                  body: Body(collection_item_id: collectionItemId, caption: caption))
    }

    func deletePost(id: String) async throws {
        try await voidRequest(path: "/social/posts/\(id)", method: "DELETE")
    }

    func likePost(id: String) async throws {
        try await voidRequest(path: "/social/posts/\(id)/like", method: "POST")
    }

    func unlikePost(id: String) async throws {
        try await voidRequest(path: "/social/posts/\(id)/like", method: "DELETE")
    }

    func comments(postId: String) async throws -> CommentsResponse {
        try await request(path: "/social/posts/\(postId)/comments")
    }

    func addComment(postId: String, content: String) async throws -> CommentWrapper {
        struct Body: Encodable { let content: String }
        return try await request(path: "/social/posts/\(postId)/comments", method: "POST", body: Body(content: content))
    }

    func followUser(id: String) async throws {
        try await voidRequest(path: "/social/follow/\(id)", method: "POST")
    }

    func unfollowUser(id: String) async throws {
        try await voidRequest(path: "/social/follow/\(id)", method: "DELETE")
    }

    func userProfile(id: String) async throws -> ProfileResponse {
        try await request(path: "/social/users/\(id)")
    }

    func searchUsers(query: String) async throws -> UsersResponse {
        let q = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        return try await request(path: "/social/users/search?q=\(q)")
    }

    func valuation(cardId: String) async throws -> ValuationResponse {
        try await request(path: "/valuation/\(cardId)")
    }
}

// MARK: - Response wrappers

struct UserWrapper: Decodable { let user: User }
struct ItemWrapper: Decodable { let item: CollectionItem }
struct PostWrapper: Decodable { let post: Post }
struct CommentWrapper: Decodable { let comment: Comment }
struct CommentsResponse: Decodable { let comments: [Comment] }
struct ProfileResponse: Decodable { let profile: UserProfile }
struct UsersResponse: Decodable { let users: [User] }
struct CollectionResponse: Decodable { let items: [CollectionItem]; let total: Int; let page: Int; let pages: Int }
struct OtherCollectionResponse: Decodable { let owner: UserProfile; let items: [CollectionItem] }
struct StatsWrapper: Decodable { let stats: CollectionStats }
struct ValuationResponse: Decodable { let valuation: Valuation?; let card: Card }

struct FeedResponse: Decodable {
    let posts: [Post]
    let page: Int
    let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case posts, page
        case hasMore = "has_more"
    }
}

struct CollectionStats: Decodable {
    let totalCards: Int
    let portfolioValue: Double?
    let totalCost: Double?
    let uniquePlayers: Int
    let yearsRepresented: Int

    enum CodingKeys: String, CodingKey {
        case totalCards       = "total_cards"
        case portfolioValue   = "portfolio_value"
        case totalCost        = "total_cost"
        case uniquePlayers    = "unique_players"
        case yearsRepresented = "years_represented"
    }
}

struct Valuation: Decodable, Identifiable {
    let id: String
    let cardId: String
    let lowPrice: Double?
    let midPrice: Double?
    let highPrice: Double?
    let saleCount: Int?
    let fetchedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case cardId    = "card_id"
        case lowPrice  = "low_price"
        case midPrice  = "mid_price"
        case highPrice = "high_price"
        case saleCount = "sale_count"
        case fetchedAt = "fetched_at"
    }
}
