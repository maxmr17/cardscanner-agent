'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import { API, CollectionItem, Valuation } from '@/lib/api';

function PriceCol({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="flex-1 text-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-base font-bold text-gray-900 dark:text-gray-100">
        {value != null ? `$${value.toFixed(2)}` : '—'}
      </p>
    </div>
  );
}

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [item, setItem] = useState<CollectionItem | null>(null);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [forSale, setForSale] = useState(false);
  const [askingPrice, setAskingPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await API.getCollection({ page: 1 });
        const found = data.items.find(i => i.id === id);
        if (found) {
          setItem(found);
          setNotes(found.notes ?? '');
          setForSale(found.for_sale ?? false);
          setAskingPrice(found.asking_price != null ? String(found.asking_price) : '');
          // Fetch valuation
          if (found.card_id) {
            try {
              const v = await API.getValuation(found.card_id);
              setValuation(v.valuation);
            } catch {}
          }
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave() {
    if (!item) return;
    setSaving(true);
    try {
      const res = await API.updateCollectionItem(item.id, {
        notes: notes || undefined,
        for_sale: forSale,
        asking_price: askingPrice ? parseFloat(askingPrice) : undefined,
      });
      setItem(res.item);
    } catch {}
    setSaving(false);
  }

  async function handleDelete() {
    if (!item || !confirm('Remove this card from your collection?')) return;
    try {
      await API.deleteCollectionItem(item.id);
      router.replace('/collection');
    } catch {}
  }

  async function handlePost() {
    if (!item) return;
    setPosting(true);
    try {
      await API.createPost(item.id, caption || undefined);
      setPostSuccess(true);
      setShowPostModal(false);
      setCaption('');
    } catch {}
    setPosting(false);
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex justify-center items-center min-h-screen">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AuthGuard>
    );
  }

  if (!item) {
    return (
      <AuthGuard>
        <div className="flex flex-col items-center justify-center min-h-screen gap-3">
          <p className="text-gray-500">Card not found.</p>
          <button onClick={() => router.back()} className="text-orange-500 font-medium text-sm">Go back</button>
        </div>
      </AuthGuard>
    );
  }

  const displayValuation = valuation ?? { low_price: item.low_price, mid_price: item.mid_price, high_price: item.high_price };

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-6">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-orange-500 mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Collection
        </button>

        {/* Card image */}
        <div className="flex justify-center mb-6">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.player_name ?? 'Card'}
              className="rounded-xl shadow-lg object-contain"
              style={{ maxHeight: 340, maxWidth: '100%' }}
            />
          ) : (
            <div className="w-48 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-gray-800 flex items-center justify-center shadow" style={{ aspectRatio: '63/88' }}>
              <span className="text-5xl font-bold text-orange-300">
                {item.player_name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? '?'}
              </span>
            </div>
          )}
        </div>

        {/* Card identity */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-5 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{item.player_name ?? 'Unknown'}</h1>
          {item.team && <p className="text-gray-500 mt-0.5">{item.team}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {item.year && <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-400">{item.year}</span>}
            {item.set_name && <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-400">{item.set_name}</span>}
            {item.variant && item.variant !== 'Base' && <span className="px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 rounded-full text-sm text-orange-600 dark:text-orange-400 font-medium">{item.variant}</span>}
            {item.condition && <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full text-sm text-blue-600 dark:text-blue-400">{item.condition}</span>}
          </div>
        </div>

        {/* Valuation */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Market Value</h2>
          <div className="flex gap-3">
            <PriceCol label="Low" value={displayValuation?.low_price} />
            <PriceCol label="Mid" value={displayValuation?.mid_price} />
            <PriceCol label="High" value={displayValuation?.high_price} />
          </div>
          {valuation?.sale_count != null && (
            <p className="text-xs text-gray-400 text-center mt-2">Based on {valuation.sale_count} eBay listings</p>
          )}
        </div>

        {/* Notes & settings */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-5 mb-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Details</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Add personal notes…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">For Sale</p>
              <p className="text-xs text-gray-400">List this card as available</p>
            </div>
            <button
              onClick={() => setForSale(v => !v)}
              className={`w-12 h-6 rounded-full transition-colors relative ${forSale ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${forSale ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {forSale && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asking Price ($)</label>
              <input
                type="number" step="0.01" min="0" value={askingPrice} onChange={e => setAskingPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          )}
          <button
            onClick={handleSave} disabled={saving}
            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowPostModal(true)}
            className="flex-1 py-3 border border-orange-500 text-orange-500 font-semibold rounded-xl text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
          >
            {postSuccess ? '✓ Posted' : 'Share to Feed'}
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 py-3 border border-red-200 dark:border-red-900/30 text-red-500 font-semibold rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Remove Card
          </button>
        </div>
      </div>

      {/* Post modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowPostModal(false)} />
          <div className="relative w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-2xl p-6 pb-8">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Share to Feed</h3>
            <textarea
              value={caption} onChange={e => setCaption(e.target.value)}
              rows={3} placeholder="Add a caption…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowPostModal(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={handlePost} disabled={posting}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
