import SwiftUI

struct CollectionView: View {
    @StateObject private var viewModel = CollectionViewModel()

    let columns = [GridItem(.adaptive(minimum: 160), spacing: 12)]

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.items.isEmpty {
                    ProgressView("Loading collection…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.items.isEmpty {
                    EmptyCollectionView()
                } else {
                    ScrollView {
                        // Stats bar
                        if let stats = viewModel.stats {
                            StatsBar(stats: stats)
                                .padding(.horizontal)
                                .padding(.top, 8)
                        }

                        // Filter bar
                        FilterBar(sort: $viewModel.sort)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(viewModel.items) { item in
                                NavigationLink(destination: CardDetailView(item: item)) {
                                    CollectionItemCard(item: item)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 20)

                        if viewModel.hasMore {
                            ProgressView().onAppear { viewModel.loadMore() }
                        }
                    }
                }
            }
            .navigationTitle("My Collection")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { viewModel.refresh() } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .refreshable { await viewModel.refreshAsync() }
            .onAppear { if viewModel.items.isEmpty { viewModel.refresh() } }
        }
    }
}

// MARK: - Stats bar

struct StatsBar: View {
    let stats: CollectionStats

    var body: some View {
        HStack(spacing: 0) {
            StatCell(label: "Cards", value: "\(stats.totalCards)")
            Divider().frame(height: 30)
            StatCell(label: "Players", value: "\(stats.uniquePlayers)")
            Divider().frame(height: 30)
            if let val = stats.portfolioValue {
                StatCell(label: "Value", value: String(format: "$%.0f", val))
            }
        }
        .padding(10)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

private struct StatCell: View {
    let label: String; let value: String
    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.headline)
            Text(label).font(.caption2).foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Filter bar

struct FilterBar: View {
    @Binding var sort: String
    let options = [("newest", "Newest"), ("oldest", "Oldest"), ("player", "Player"), ("value_desc", "Value ↓")]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(options, id: \.0) { value, label in
                    Button(label) { sort = value }
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(sort == value ? Color.orange : Color(.systemGray5))
                        .foregroundColor(sort == value ? .white : .primary)
                        .clipShape(Capsule())
                }
            }
            .padding(.vertical, 4)
        }
    }
}

// MARK: - Item card

struct CollectionItemCard: View {
    let item: CollectionItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            AsyncImage(url: URL(string: item.imageUrl ?? "")) { phase in
                switch phase {
                case .success(let img): img.resizable().scaledToFill()
                default: Rectangle().fill(Color.gray.opacity(0.2))
                    .overlay(Image(systemName: "photo").foregroundColor(.gray))
                }
            }
            .frame(height: 160)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(item.playerName ?? "Unknown")
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                if let year = item.year, let set = item.setName {
                    Text("\(year) \(set)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
                if let price = item.midPriceFormatted {
                    Text(price)
                        .font(.caption.weight(.bold))
                        .foregroundColor(.green)
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 4)
        }
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .shadow(color: .black.opacity(0.08), radius: 4, x: 0, y: 2)
    }
}

// MARK: - Empty state

struct EmptyCollectionView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "rectangle.stack.badge.plus")
                .font(.system(size: 64))
                .foregroundColor(.orange)
            Text("No cards yet").font(.title2.bold())
            Text("Tap the Scan tab to start scanning your football cards")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
