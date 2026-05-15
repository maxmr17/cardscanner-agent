import Foundation

@MainActor
final class CollectionViewModel: ObservableObject {
    @Published var items: [CollectionItem] = []
    @Published var stats: CollectionStats?
    @Published var isLoading = false
    @Published var sort = "newest" {
        didSet { if oldValue != sort { refresh() } }
    }

    private var page = 1
    private var totalPages = 1

    var hasMore: Bool { page < totalPages }

    func refresh() {
        page = 1
        items = []
        isLoading = true
        Task {
            defer { isLoading = false }
            await withTaskGroup(of: Void.self) { group in
                group.addTask { @MainActor in await self.load() }
                group.addTask { @MainActor in await self.loadStats() }
                for await _ in group { }
            }
        }
    }

    func refreshAsync() async {
        page = 1
        items = []
        await withTaskGroup(of: Void.self) { group in
            group.addTask { @MainActor in await self.load() }
            group.addTask { @MainActor in await self.loadStats() }
            for await _ in group { }
        }
    }

    func loadMore() {
        guard hasMore, !isLoading else { return }
        page += 1
        Task { await load() }
    }

    private func load() async {
        do {
            let response = try await APIService.shared.collection(page: page, sort: sort)
            if page == 1 {
                items = response.items
            } else {
                items += response.items
            }
            totalPages = response.pages
        } catch {
            print("Collection load error:", error)
        }
    }

    private func loadStats() async {
        do {
            let wrapper = try await APIService.shared.collectionStats()
            stats = wrapper.stats
        } catch {}
    }
}
