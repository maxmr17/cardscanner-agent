'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { API, CollectionItem, CollectionStats } from '@/lib/api';

function StatBlock({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="text-center px-2">
      <p className={`text-xl font-bold tabular-nums ${highlight ? 'text-orange-500' : 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="aspect-card rounded-xl skeleton" />
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [items, setItems]     = useState<CollectionItem[]>([]);
  const [stats, setStats]     = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [col, st] = await Promise.all([
          API.getCollection({ sort: 'newest' }),
          API.getCollectionStats(),
        ]);
        setItems(col.items);
        setStats(st.stats);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const portfolioValue = stats?.portfolio_value;
  const formattedValue = portfolioValue != null
    ? portfolioValue >= 1000 ? `$${(portfolioValue / 1000).toFixed(1)}k` : `$${portfolioValue.toFixed(0)}`
    : '—';

  return (
    <AuthGuard>
      <div className="max-w-3xl mx-auto px-4 pt-5 pb-28 md:pb-8">
        {/* Profile card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl ring-1 ring-gray-100 dark:ring-gray-800 overflow-hidden shadow-sm mb-5">
          {/* Color bar */}
          <div className="h-16 bg-gradient-to-r from-orange-400 to-orange-600" />

          <div className="px-5 pb-5">
            {/* Avatar + sign out */}
            <div className="flex items-end justify-between -mt-8 mb-3">
              <div className="w-16 h-16 rounded-2xl ring-4 ring-white dark:ring-gray-900 overflow-hidden bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-orange-500">
                    {(user?.display_name ?? user?.username ?? '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={logout}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Sign out
              </button>
            </div>

            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
              {user?.display_name ?? user?.username}
            </h1>
            <p className="text-sm text-gray-400">@{user?.username}</p>
            {user?.bio && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{user.bio}</p>}

            {stats && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-4 divide-x divide-gray-100 dark:divide-gray-800">
                <StatBlock label="Cards"   value={stats.total_cards} />
                <StatBlock label="Value"   value={formattedValue} highlight />
                <StatBlock label="Players" value={stats.unique_players} />
                <StatBlock label="Years"   value={stats.years_represented} />
              </div>
            )}
          </div>
        </div>

        {/* Collection grid */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">My Cards</h2>
          <Link href="/collection" className="text-xs text-orange-500 font-semibold hover:text-orange-600 transition-colors">
            View all →
          </Link>
        </div>

        {loading ? (
          <SkeletonGrid />
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="font-medium text-gray-700 dark:text-gray-300">No cards yet</p>
            <Link href="/scan" className="text-orange-500 text-sm mt-2 inline-block font-semibold hover:text-orange-600 transition-colors">
              Scan your first card →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {items.slice(0, 20).map(item => (
              <Link key={item.id} href={`/collection/${item.id}`} className="group">
                <div className="aspect-card bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden relative shadow-sm group-hover:shadow-md transition-all duration-200 group-hover:-translate-y-0.5">
                  {item.image_url ? (
                    <img
                      src={item.image_url} alt={item.player_name ?? ''}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-gray-800">
                      <span className="text-lg font-bold text-orange-300">
                        {item.player_name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? '?'}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
