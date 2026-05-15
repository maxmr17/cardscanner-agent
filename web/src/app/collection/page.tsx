'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { API, CollectionItem, CollectionStats } from '@/lib/api';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-4 flex-1 min-w-0">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{value}</p>
    </div>
  );
}

function CardThumb({ item }: { item: CollectionItem }) {
  const initials = item.player_name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? '?';
  return (
    <Link href={`/collection/${item.id}`} className="group block">
      <div className="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden aspect-[63/88] relative shadow hover:shadow-md transition-shadow">
        {item.image_url ? (
          <img src={item.image_url} alt={item.player_name ?? 'Card'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-gray-800">
            <span className="text-2xl font-bold text-orange-400">{initials}</span>
          </div>
        )}
        {item.mid_price != null && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
            <p className="text-white text-xs font-semibold">${item.mid_price.toFixed(0)}</p>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{item.player_name ?? '—'}</p>
      <p className="text-xs text-gray-400 truncate">{[item.year, item.set_name].filter(Boolean).join(' ')}</p>
    </Link>
  );
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'player', label: 'Player A–Z' },
  { value: 'value_desc', label: 'Highest Value' },
  { value: 'value_asc', label: 'Lowest Value' },
];

export default function CollectionPage() {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [sort, setSort] = useState('newest');
  const [player, setPlayer] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (p: number, s: string, pl: string, reset: boolean) => {
    setLoading(true);
    try {
      const [colData, statsData] = await Promise.all([
        API.getCollection({ page: p, sort: s, player: pl || undefined }),
        p === 1 ? API.getCollectionStats() : Promise.resolve(null),
      ]);
      setItems(prev => reset ? colData.items : [...prev, ...colData.items]);
      setPages(colData.pages);
      if (statsData) setStats(statsData.stats);
    } catch {}
    setLoading(false);
    setInitial(false);
  }, []);

  useEffect(() => {
    setPage(1);
    load(1, sort, player, true);
  }, [sort, player, load]);

  // Infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && page < pages && !loading) {
        const next = page + 1;
        setPage(next);
        load(next, sort, player, false);
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [page, pages, loading, sort, player, load]);

  // Debounced player filter
  const playerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handlePlayerChange(v: string) {
    if (playerTimer.current) clearTimeout(playerTimer.current);
    playerTimer.current = setTimeout(() => setPlayer(v), 300);
  }

  return (
    <AuthGuard>
      <div className="max-w-5xl mx-auto px-4 py-6 pb-28 md:pb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">My Collection</h1>

        {/* Stats */}
        {stats && (
          <div className="flex gap-3 mb-5 overflow-x-auto scrollbar-hide pb-1">
            <StatCard label="Cards" value={String(stats.total_cards)} />
            <StatCard label="Value" value={stats.portfolio_value != null ? `$${stats.portfolio_value.toFixed(0)}` : '—'} />
            <StatCard label="Players" value={String(stats.unique_players)} />
            <StatCard label="Years" value={String(stats.years_represented)} />
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <input
            type="text"
            placeholder="Search player…"
            onChange={e => handlePlayerChange(e.target.value)}
            className="flex-1 min-w-[160px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <select
            value={sort} onChange={e => setSort(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Grid */}
        {initial && loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" />
            </svg>
            <p className="font-medium">No cards yet</p>
            <p className="text-sm mt-1">Scan a card to add it to your collection</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map(item => <CardThumb key={item.id} item={item} />)}
          </div>
        )}

        <div ref={loaderRef} className="py-4 flex justify-center">
          {loading && !initial && <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />}
        </div>
      </div>
    </AuthGuard>
  );
}
