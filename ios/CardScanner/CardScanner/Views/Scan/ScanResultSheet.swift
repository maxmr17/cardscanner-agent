import SwiftUI

struct ScanResultSheet: View {
    let result: ScanResult
    @State private var showSharePrompt = false
    @State private var caption = ""
    @State private var isSharing = false
    @State private var shareError: String?
    @State private var shared = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    // Card image
                    AsyncImage(url: URL(string: result.item.imageUrl ?? "")) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable().scaledToFit()
                        default:
                            Rectangle().fill(Color.gray.opacity(0.2))
                                .overlay(Image(systemName: "photo").font(.largeTitle).foregroundColor(.gray))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 280)
                    .clipped()

                    VStack(alignment: .leading, spacing: 16) {
                        // Identification result
                        let id = result.identification
                        VStack(alignment: .leading, spacing: 6) {
                            Text(id.playerName ?? "Unknown Player")
                                .font(.title2.bold())
                            if let team = id.team { Text(team).foregroundColor(.secondary) }
                            HStack(spacing: 8) {
                                if let year = id.year { Chip(text: String(year)) }
                                if let set = id.setName { Chip(text: set) }
                                if let variant = id.variant { Chip(text: variant, color: .orange) }
                            }
                            if let num = id.cardNumber { Text("Card #\(num)").font(.caption).foregroundColor(.secondary) }
                        }

                        Divider()

                        // Market value
                        if let card = result.card, let mid = card.midPrice {
                            ValuationRow(low: card.lowPrice, mid: mid, high: card.highPrice)
                        }

                        // Confidence
                        if let conf = id.confidence {
                            ConfidenceRow(confidence: conf)
                        }

                        Divider()

                        // Share to feed
                        if !shared {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Share to Feed")
                                    .font(.headline)
                                TextField("Add a caption… (optional)", text: $caption, axis: .vertical)
                                    .textFieldStyle(.roundedBorder)
                                    .lineLimit(3)

                                Button {
                                    shareToFeed()
                                } label: {
                                    Label(isSharing ? "Sharing…" : "Post Card", systemImage: "square.and.arrow.up")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(.orange)
                                .disabled(isSharing)

                                if let err = shareError {
                                    Text(err).font(.caption).foregroundColor(.red)
                                }
                            }
                        } else {
                            Label("Posted to your feed!", systemImage: "checkmark.circle.fill")
                                .foregroundColor(.green)
                                .font(.subheadline)
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Card Identified")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func shareToFeed() {
        isSharing = true
        Task {
            do {
                _ = try await APIService.shared.createPost(
                    collectionItemId: result.item.id,
                    caption: caption.isEmpty ? nil : caption
                )
                shared = true
            } catch {
                shareError = error.localizedDescription
            }
            isSharing = false
        }
    }
}

private struct Chip: View {
    let text: String
    var color: Color = .blue
    var body: some View {
        Text(text)
            .font(.caption.weight(.medium))
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .clipShape(Capsule())
    }
}

private struct ValuationRow: View {
    let low: Double?; let mid: Double; let high: Double?
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Market Value (eBay recent sales)").font(.caption).foregroundColor(.secondary)
            HStack {
                if let l = low { ValBox(label: "Low", value: l) }
                ValBox(label: "Mid", value: mid, highlight: true)
                if let h = high { ValBox(label: "High", value: h) }
            }
        }
    }
}

private struct ValBox: View {
    let label: String; let value: Double; var highlight = false
    var body: some View {
        VStack(spacing: 2) {
            Text(label).font(.caption2).foregroundColor(.secondary)
            Text(String(format: "$%.2f", value))
                .font(.headline)
                .foregroundColor(highlight ? .green : .primary)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

private struct ConfidenceRow: View {
    let confidence: Double
    var body: some View {
        HStack {
            Text("ID Confidence")
                .font(.caption).foregroundColor(.secondary)
            Spacer()
            Text(String(format: "%.0f%%", confidence * 100))
                .font(.caption.weight(.semibold))
                .foregroundColor(confidence > 0.8 ? .green : confidence > 0.6 ? .orange : .red)
        }
    }
}
