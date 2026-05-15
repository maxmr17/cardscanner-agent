'use client';

import { useState } from 'react';
import { ScanResult } from '@/lib/api';

interface ScanResultCardProps {
  result: ScanResult;
  onClose: () => void;
  onScanAgain: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : pct >= 60
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {pct}% confidence
    </span>
  );
}

function ConditionBadge({ condition }: { condition?: string }) {
  if (!condition) return null;
  const colorMap: Record<string, string> = {
    mint: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'near mint': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    nm: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    excellent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'very good': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    good: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    poor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const key = condition.toLowerCase();
  const cls = colorMap[key] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {condition}
    </span>
  );
}

export default function ScanResultCard({ result, onClose, onScanAgain }: ScanResultCardProps) {
  const [copied, setCopied] = useState(false);

  const item = result.item;

  const priceDisplay = item.mid_price != null
    ? `$${item.mid_price.toFixed(2)}`
    : null;

  const subtitle = [result.year, result.set_name, result.variant]
    .filter(Boolean)
    .join(' · ');

  function copyInfo() {
    const text = [
      result.player_name,
      result.team,
      subtitle,
      result.card_number ? `#${result.card_number}` : null,
      result.condition_estimate,
      priceDisplay ? `Est. value: ${priceDisplay}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Scan Result</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Card image + info */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex gap-4 items-start">
          {/* Card thumbnail */}
          {item.image_url ? (
            <div className="flex-shrink-0 w-24 rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700">
              {/* aspect ratio ~63:88 */}
              <div className="relative" style={{ paddingBottom: `${(88 / 63) * 100}%` }}>
                <img
                  src={item.image_url}
                  alt={result.player_name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
            </div>
          ) : (
            <div
              className="flex-shrink-0 w-24 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md"
              style={{ aspectRatio: '63/88' }}
            >
              <span className="text-white font-bold text-lg text-center px-1 leading-tight">
                {result.player_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">
              {result.player_name}
            </h3>
            {result.team && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{result.team}</p>
            )}
            {result.position && (
              <p className="text-xs text-gray-400 dark:text-gray-500">{result.position}</p>
            )}

            <div className="flex flex-wrap gap-1.5 mt-2">
              <ConfidenceBadge confidence={result.confidence} />
              {result.condition_estimate && (
                <ConditionBadge condition={result.condition_estimate} />
              )}
            </div>
          </div>
        </div>

        {/* Card details */}
        <div className="mt-4 space-y-3">
          {/* Card info grid */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {result.year && (
              <>
                <span className="text-gray-500 dark:text-gray-400">Year</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{result.year}</span>
              </>
            )}
            {result.set_name && (
              <>
                <span className="text-gray-500 dark:text-gray-400">Set</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{result.set_name}</span>
              </>
            )}
            {result.variant && (
              <>
                <span className="text-gray-500 dark:text-gray-400">Variant</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{result.variant}</span>
              </>
            )}
            {result.card_number && (
              <>
                <span className="text-gray-500 dark:text-gray-400">Card #</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">#{result.card_number}</span>
              </>
            )}
          </div>

          {/* Valuation */}
          {(item.low_price != null || item.mid_price != null || item.high_price != null) && (
            <div className="bg-orange-50 dark:bg-orange-500/10 rounded-xl p-3">
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-2 uppercase tracking-wide">
                Estimated Value
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {item.low_price != null && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Low</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">${item.low_price.toFixed(2)}</p>
                  </div>
                )}
                {item.mid_price != null && (
                  <div>
                    <p className="text-xs text-orange-500 font-medium">Mid</p>
                    <p className="font-bold text-orange-500 text-lg">${item.mid_price.toFixed(2)}</p>
                  </div>
                )}
                {item.high_price != null && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">High</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">${item.high_price.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {result.notes && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{result.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-6 pt-2 flex gap-2 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={copyInfo}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={onScanAgain}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Scan again
        </button>
      </div>
    </div>
  );
}
