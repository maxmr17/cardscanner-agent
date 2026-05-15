'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { API, CollectionItem, CollectionStats } from '@/lib/api';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
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

  return (
    <AuthGuard>
      <div className="max-w-3xl mx-auto px-4 py-6 pb-28 md:pb-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-5 mb-5">
          <div className="flex items-center gap-4">
            <Avatar src={user?.avatar_url} name={user?.display_name ?? user?.username} size={64} />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{user?.display_name ?? user?.username}</h1>
              <p className="text-sm text-gray-400">@{user?.username}</p>
              {user?.bio && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{user.bio}</p>}
            </div>
            <button
              onClick={logout}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors font-medium"
            >
              Sign out
            </button>
          </div>

          {stats && (
            <div className="mt-4 grid grid-cols-4 gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              {[
                ['Cards', stats.total_cards],
                ['Value', stats.portfolio_value != null ? `$${stats.portfolio_value.toFixed(0)}` : '—'],
                ['Players', stats.unique_players],
                ['Years', stats.years_represented],
              ].map(([label, value]) => (
                <div key={label as string} className="text-center">
                  <p className="text-base font-bold text-gray-900 dark:text-gray-100">{value}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Collection grid */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">My Cards</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="font-medium">No cards yet</p>
            <Link href="/scan" className="text-orange-500 text-sm mt-1 inline-block">Scan your first card →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {items.map(item => (
              <Link key={item.id} href={`/collection/${item.id}`} className="group">
                <div className="aspect-[63/88] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden relative">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.player_name ?? ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
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
