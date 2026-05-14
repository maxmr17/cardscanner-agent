import Foundation

struct Card: Codable, Identifiable {
    let id: String
    let playerName: String
    let team: String?
    let position: String?
    let year: Int?
    let setName: String?
    let variant: String?
    let cardNumber: String?
    let sport: String
    let createdAt: Date?

    // Valuation (joined from API)
    let lowPrice: Double?
    let midPrice: Double?
    let highPrice: Double?
    let saleCount: Int?
    let valuationAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case playerName   = "player_name"
        case team, position, year
        case setName      = "set_name"
        case variant
        case cardNumber   = "card_number"
        case sport
        case createdAt    = "created_at"
        case lowPrice     = "low_price"
        case midPrice     = "mid_price"
        case highPrice    = "high_price"
        case saleCount    = "sale_count"
        case valuationAt  = "valuation_at"
    }

    var displayName: String {
        var parts: [String] = []
        if let year = year { parts.append(String(year)) }
        if let set = setName { parts.append(set) }
        if let variant = variant, variant != "Base" { parts.append(variant) }
        parts.append(playerName)
        return parts.joined(separator: " ")
    }

    var midPriceFormatted: String? {
        guard let price = midPrice else { return nil }
        return String(format: "$%.2f", price)
    }
}

struct CollectionItem: Codable, Identifiable {
    let id: String
    let userId: String?
    let cardId: String?
    let imageUrl: String?
    let condition: String?
    let notes: String?
    let acquiredDate: String?
    let purchasePrice: Double?
    let forSale: Bool?
    let askingPrice: Double?
    let createdAt: Date?

    // Joined card fields
    let playerName: String?
    let team: String?
    let year: Int?
    let setName: String?
    let variant: String?
    let cardNumber: String?
    let lowPrice: Double?
    let midPrice: Double?
    let highPrice: Double?

    enum CodingKeys: String, CodingKey {
        case id
        case userId        = "user_id"
        case cardId        = "card_id"
        case imageUrl      = "image_url"
        case condition, notes
        case acquiredDate  = "acquired_date"
        case purchasePrice = "purchase_price"
        case forSale       = "for_sale"
        case askingPrice   = "asking_price"
        case createdAt     = "created_at"
        case playerName    = "player_name"
        case team, year
        case setName       = "set_name"
        case variant
        case cardNumber    = "card_number"
        case lowPrice      = "low_price"
        case midPrice      = "mid_price"
        case highPrice     = "high_price"
    }

    var displayTitle: String {
        let name = playerName ?? "Unknown Player"
        var parts: [String] = []
        if let year = year { parts.append(String(year)) }
        if let set = setName { parts.append(set) }
        return parts.isEmpty ? name : "\(name) · \(parts.joined(separator: " "))"
    }

    var midPriceFormatted: String? {
        guard let price = midPrice else { return nil }
        return String(format: "$%.2f", price)
    }
}

struct CardIdentification: Codable {
    let playerName: String?
    let team: String?
    let position: String?
    let year: Int?
    let setName: String?
    let variant: String?
    let cardNumber: String?
    let conditionEstimate: String?
    let confidence: Double?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case playerName       = "player_name"
        case team, position, year
        case setName          = "set_name"
        case variant
        case cardNumber       = "card_number"
        case conditionEstimate = "condition_estimate"
        case confidence, notes
    }
}

struct ScanResult: Codable {
    let item: CollectionItem
    let card: Card?
    let identification: CardIdentification
}
