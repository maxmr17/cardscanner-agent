import SwiftUI

struct ScanResultSheet: View {
    let session: ScanSession
    @State private var caption   = ""
    @State private var isSharing = false
    @State private var shareError: String?
    @State private var shared    = false
    @Environment(\.dismiss) private var dismiss

    private var result: ScanResult  { session.result }
    private var id:     CardIdentification { result.identification }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    cardImage
                    detailsPanel
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

    // MARK: - Card image
    //
    // Show the locally perspective-corrected UIImage that was actually sent to GPT-4o.
    // Falls back to the server URL only if the local image is unavailable (edge case).

    @ViewBuilder
    private var cardImage: some View {
        if let local = session.capturedImage {
            Image(uiImage: local)
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity)
                .frame(maxHeight: 320)
                .background(Color.black)
        } else {
            AsyncImage(url: URL(string: result.item.imageUrl ?? "")) { phase in
                switch phase {
                case .success(let img): img.resizable().scaledToFit()
                default:
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .overlay(Image(systemName: "photo").font(.largeTitle).foregroundColor(.gray))
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 280)
            .clipped()
        }
    }

    // MARK: - Details

    private var detailsPanel: some View {
        VStack(alignment: .leading, spacing: 18) {
            // Identity
            VStack(alignment: .leading, spacing: 6) {
                Text(id.playerName ?? "Unknown Player")
                    .font(.title2.bold())
                if let team = id.team {
                    Text(team).foregroundColor(.secondary)
                }
                HStack(spacing: 8) {
                    if let year    = id.year     { Chip(text: String(year)) }
                    if let set     = id.setName  { Chip(text: set) }
                    if let variant = id.variant  { Chip(text: variant, color: .orange) }
                }
                if let num = id.cardNumber {
                    Text("Card #\(num)").font(.caption).foregroundColor(.secondary)
                }
                if let pos = id.position {
                    Text(pos).font(.caption).foregroundColor(.secondary)
                }
            }

            // Confidence meter
            if let conf = id.confidence {
                ConfidenceRow(confidence: conf)
            }

            Divider()

            // Market value
            if let card = result.card, let mid = card.midPrice {
                ValuationRow(low: card.lowPrice, mid: mid, high: card.highPrice)
                Divider()
            }

            // Condition estimate from GPT-4o
            if let cond = id.conditionEstimate {
                HStack {
                    Text("Condition estimate").font(.caption).foregroundColor(.secondary)
                    Spacer()
                    Text(cond).font(.caption.weight(.semibold))
                }
            }

            // GPT notes
            if let notes = id.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            Divider()

            // Share to feed
            shareSection
        }
        .padding()
    }

    @ViewBuilder
    private var shareSection: some View {
        if !shared {
            VStack(alignment: .leading, spacing: 10) {
                Text("Share to Feed").font(.headline)

                TextField("Add a caption… (optional)", text: $caption, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(3)

                Button {
                    Task { await shareToFeed() }
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
        }
    }

    private func shareToFeed() async {
        isSharing = true
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

// MARK: - Subviews

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
            Text("Market Value (eBay recent sales)")
                .font(.caption).foregroundColor(.secondary)
            HStack {
                if let l = low  { ValBox(label: "Low",  value: l) }
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
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("AI Confidence")
                    .font(.caption).foregroundColor(.secondary)
                Spacer()
                Text(String(format: "%.0f%%", confidence * 100))
                    .font(.caption.weight(.semibold))
                    .foregroundColor(labelColor)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color(.systemGray5))
                    RoundedRectangle(cornerRadius: 3)
                        .fill(labelColor)
                        .frame(width: geo.size.width * confidence)
                }
            }
            .frame(height: 5)
        }
    }

    private var labelColor: Color {
        confidence > 0.85 ? .green : confidence > 0.65 ? .orange : .red
    }
}
