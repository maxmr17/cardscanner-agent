import SwiftUI

struct CardDetailView: View {
    let item: CollectionItem
    @State private var condition: String
    @State private var notes: String
    @State private var forSale: Bool
    @State private var askingPrice: String
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var showDeleteConfirm = false
    @Environment(\.dismiss) private var dismiss

    init(item: CollectionItem) {
        self.item = item
        _condition   = State(initialValue: item.condition ?? "")
        _notes       = State(initialValue: item.notes ?? "")
        _forSale     = State(initialValue: item.forSale ?? false)
        _askingPrice = State(initialValue: item.askingPrice.map { String(format: "%.2f", $0) } ?? "")
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Card image
                AsyncImage(url: URL(string: item.imageUrl ?? "")) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFit()
                    default: Rectangle().fill(Color.gray.opacity(0.1))
                        .overlay(Image(systemName: "photo").font(.largeTitle).foregroundColor(.gray))
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(maxHeight: 320)

                VStack(alignment: .leading, spacing: 20) {
                    // Card identity
                    Group {
                        Text(item.playerName ?? "Unknown Player")
                            .font(.title2.bold())
                        if let team = item.team {
                            Text(team).foregroundColor(.secondary)
                        }
                        HStack(spacing: 8) {
                            if let year = item.year { Chip(text: String(year)) }
                            if let set = item.setName { Chip(text: set) }
                            if let v = item.variant, v != "Base" { Chip(text: v, color: .orange) }
                        }
                        if let num = item.cardNumber {
                            Text("Card #\(num)").font(.caption).foregroundColor(.secondary)
                        }
                    }

                    Divider()

                    // Valuation
                    if let mid = item.midPrice {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Market Value").font(.headline)
                            HStack {
                                if let l = item.lowPrice { PriceBox(label: "Low", value: l) }
                                PriceBox(label: "Mid", value: mid, highlight: true)
                                if let h = item.highPrice { PriceBox(label: "High", value: h) }
                            }
                        }
                        Divider()
                    }

                    // Condition
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Condition").font(.headline)
                        Picker("Condition", selection: $condition) {
                            Text("Not set").tag("")
                            ForEach(["Poor","Fair","Good","Very Good","Excellent","Near Mint","Mint","Gem Mint"], id: \.self) { c in
                                Text(c).tag(c)
                            }
                        }
                        .pickerStyle(.menu)
                    }

                    // Notes
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Notes").font(.headline)
                        TextField("Add notes…", text: $notes, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(3...6)
                    }

                    // For sale toggle
                    Toggle("List for Sale", isOn: $forSale)
                    if forSale {
                        HStack {
                            Text("Asking Price")
                            Spacer()
                            Text("$")
                            TextField("0.00", text: $askingPrice)
                                .keyboardType(.decimalPad)
                                .frame(width: 80)
                                .multilineTextAlignment(.trailing)
                        }
                    }

                    if let err = saveError {
                        Text(err).font(.caption).foregroundColor(.red)
                    }

                    Button {
                        Task { await save() }
                    } label: {
                        Text(isSaving ? "Saving…" : "Save Changes")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)
                    .disabled(isSaving)
                }
                .padding()
            }
        }
        .navigationTitle(item.playerName ?? "Card Detail")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(role: .destructive) { showDeleteConfirm = true } label: {
                    Image(systemName: "trash")
                }
            }
        }
        .confirmationDialog("Delete this card from your collection?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { Task { await delete() } }
        }
    }

    private func save() async {
        isSaving = true; saveError = nil
        do {
            _ = try await APIService.shared.updateItem(
                id: item.id,
                condition: condition.isEmpty ? nil : condition,
                notes: notes.isEmpty ? nil : notes,
                forSale: forSale,
                askingPrice: Double(askingPrice)
            )
        } catch { saveError = error.localizedDescription }
        isSaving = false
    }

    private func delete() async {
        do {
            try await APIService.shared.deleteItem(id: item.id)
            dismiss()
        } catch {}
    }
}

private struct Chip: View {
    let text: String; var color: Color = .blue
    var body: some View {
        Text(text)
            .font(.caption.weight(.medium))
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(color.opacity(0.15)).foregroundColor(color)
            .clipShape(Capsule())
    }
}

private struct PriceBox: View {
    let label: String; let value: Double; var highlight = false
    var body: some View {
        VStack(spacing: 2) {
            Text(label).font(.caption2).foregroundColor(.secondary)
            Text(String(format: "$%.2f", value)).font(.headline)
                .foregroundColor(highlight ? .green : .primary)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
