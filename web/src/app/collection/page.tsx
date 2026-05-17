'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { API, CollectionItem, CollectionStats } from '@/lib/api';

function formatValue(v?: number | null) {
  if (v == null) return '—';
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function StatPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl ring-1 ring-gray-200 dark:ring-gray-800 px-4 py-3 flex-1 min-w-0">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide truncate">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 tabular-nums truncate">{value}</p>
      {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="aspect-card rounded-xl skeleton" />
      <div className="h-2.5 w-3/4 rounded skeleton" />
      <div className="h-2 w-1/2 rounded skeleton" />
    </div>
  );
}

function CardThumb({ item }: { item: CollectionItem }) {
  const initials = item.player_name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? '?';
  const isRare   = /prizm|refractor|gold|auto|rookie|patch/i.test(item.variant ?? '');

  return (
    <Link href={`/collection/${item.id}`} className="group block">
      <div className={`aspect-card rounded-xl overflow-hidden relative shadow-sm hover:shadow-md transition-all duration-200 group-hover:-translate-y-0.5 ${isRare ? 'ring-1 ring-amber-400/50' : ''}`}>
        {item.image_url ? (
          <>
            <img
              src={item.image_url} alt={item.player_name ?? 'Card'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {isRare && <div className="absolute inset-0 holo-overlay" />}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-gray-800">
            <span className="text-xl font-bold text-orange-400">{initials}</span>
          </div>
        )}

        {/* Price badge */}
        {item.mid_price != null && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-2.5">
            <p className="text-white text-xs font-bold tabular-nums">${item.mid_price.toFixed(0)}</p>
          </div>
        )}

        {/* Rare badge */}
        {isRare && (
          <div className="absolute top-1.5 right-1.5">
            <div className="w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs font-semibold text-gray-800 dark:text-gray-200 truncate leading-tight">{item.player_name ?? '—'}</p>
      <p className="text-[11px] text-gray-400 truncate">{[item.year, item.set_name].filter(Boolean).join(' · ')}</p>
    </Link>
  );
}

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest' },
  { value: 'oldest',     label: 'Oldest' },
  { value: 'player',     label: 'A–Z' },
  { value: 'value_desc', label: '$ High' },
  { value: 'value_asc',  label: '$ Low' },
];

export default function CollectionPage() {
  const [items, setItems]     = useState<CollectionItem[]>([]);
  const [stats, setStats]     = useState<CollectionStats | null>(null);
  const [sort, setSort]       = useState('newest');
  const [player, setPlayer]   = useState('');
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [skeletal, setSkeletal] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);
  const playerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setSkeletal(false);
  }, []);

  useEffect(() => {
    setPage(1);
    setSkeletal(true);
    load(1, sort, player, true);
  }, [sort, player, load]);

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

  function handlePlayerChange(v: string) {
    if (playerTimer.current) clearTimeout(playerTimer.current);
    playerTimer.current = setTimeout(() => setPlayer(v), 320);
  }

  return (
    <AuthGuard>
      <div className="max-w-5xl mx-auto px-4 pt-5 pb-28 md:pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Collection</h1>
          <Link href="/scan" className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Scan
          </Link>
        </div>

        {/* Stats */}
        {stats && (
          <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide">
            <StatPill label="Cards"   value={String(stats.total_cards)} />
            <StatPill label="Value"   value={formatValue(stats.portfolio_value)} sub={stats.total_cost ? `cost ${formatValue(stats.total_cost)}` : undefined} />
            <StatPill label="Players" value={String(stats.unique_players)} />
            <StatPill label="Years"   value={String(stats.years_represented)} />
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2.5 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text" placeholder="Search player…"
              onChange={e => handlePlayerChange(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-shadow"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {SORT_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setSort(o.value)}
                className={`px-3 py-2.5 text-sm font-medium rounded-xl border transition-all whitespace-nowrap ${
                  sort === o.value
                    ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-orange-300 dark:hover:border-orange-700'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {skeletal ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 15 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700 dark:text-gray-300 text-base">
                {player ? 'No cards match that search' : 'No cards yet'}
              </p>
              <p className="text-sm mt-1">
                {player ? 'Try a different name' : 'Scan your first card to get started'}
              </p>
            </div>
            {!player && (
              <Link href="/scan" className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
                Scan a card →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map(item => <CardThumb key={item.id} item={item} />)}
          </div>
        )}

        <div ref={loaderRef} className="py-6 flex justify-center">
          {loading && !skeletal && (
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
