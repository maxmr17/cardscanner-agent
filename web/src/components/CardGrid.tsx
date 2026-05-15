'use client';

import Link from 'next/link';
import { CollectionItem } from '@/lib/api';

function formatPrice(v?: number | null): string | null {
  return v != null ? `$${v.toFixed(2)}` : null;
}

function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function ConditionDot({ condition }: { condition?: string }) {
  if (!condition) return null;
  const lc = condition.toLowerCase();
  const color =
    lc.includes('mint') ? 'bg-green-400'
    : lc.includes('excellent') || lc.includes('nm') ? 'bg-emerald-400'
    : lc.includes('very good') ? 'bg-blue-400'
    : lc.includes('good') ? 'bg-yellow-400'
    : lc.includes('poor') ? 'bg-red-400'
    : 'bg-gray-400';
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${color} flex-shrink-0`} title={condition} />
  );
}

interface CardGridProps {
  items: CollectionItem[];
  loading?: boolean;
  emptyMessage?: string;
}

export default function CardGrid({ items, loading = false, emptyMessage = 'No cards found.' }: CardGridProps) {
  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-xl shadow overflow-hidden animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-800" style={{ aspectRatio: '63/88' }} />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
              <div className="h-2.5 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" />
          </svg>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
      {items.map((item) => {
        const price = formatPrice(item.mid_price);
        const subtitle = [item.year, item.set_name].filter(Boolean).join(' · ');

        return (
          <Link
            key={item.id}
            href={`/collection/${item.id}`}
            className="group bg-white dark:bg-gray-900 rounded-xl shadow overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Card image / placeholder */}
            <div
              className="relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700"
              style={{ aspectRatio: '63/88' }}
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.player_name ?? 'Card'}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">
                    {getInitials(item.player_name)}
                  </span>
                  {item.team && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 px-2 text-center leading-tight">
                      {item.team}
                    </span>
                  )}
                </div>
              )}

              {/* For sale badge */}
              {item.for_sale && (
                <div className="absolute top-2 right-2">
                  <span className="bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-md shadow">
                    FOR SALE
                  </span>
                </div>
              )}
            </div>

            {/* Card info */}
            <div className="p-3">
              <div className="flex items-start justify-between gap-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight line-clamp-1">
                  {item.player_name ?? 'Unknown Player'}
                </p>
                {price && (
                  <span className="text-xs font-bold text-orange-500 whitespace-nowrap flex-shrink-0">
                    {price}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                  {subtitle}
                </p>
              )}
              {item.condition && (
                <div className="flex items-center gap-1 mt-1">
                  <ConditionDot condition={item.condition} />
                  <span className="text-xs text-gray-400 dark:text-gray-500">{item.condition}</span>
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
