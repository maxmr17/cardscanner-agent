import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            CollectionView()
                .tabItem { Label("Collection", systemImage: "rectangle.stack.fill") }
                .tag(0)

            ScanView()
                .tabItem { Label("Scan", systemImage: "viewfinder") }
                .tag(1)

            FeedView()
                .tabItem { Label("Feed", systemImage: "rectangle.grid.2x2.fill") }
                .tag(2)

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.fill") }
                .tag(3)
        }
        .accentColor(.orange)
    }
}
