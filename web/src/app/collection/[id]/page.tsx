'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import { API, CollectionItem, Valuation } from '@/lib/api';

const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Very Good', 'Good', 'Fair', 'Poor'];
const RARE_RE = /prizm|refractor|gold|rainbow|superfractor|auto|patch|rookie|rpa|ssp/i;

function PriceBox({ label, value, highlight }: { label: string; value?: number | null; highlight?: boolean }) {
  return (
    <div className={`flex-1 text-center rounded-2xl p-4 ${highlight ? 'bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-800' : 'bg-gray-50 dark:bg-gray-800'}`}>
      <p className={`text-xs font-medium mb-1 ${highlight ? 'text-orange-500' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-lg font-bold tabular-nums ${highlight ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'}`}>
        {value != null ? `$${value.toFixed(2)}` : '—'}
      </p>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel, destructive = true }: {
  message: string; onConfirm: () => void; onCancel: () => void; destructive?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-scale-in">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{message}</p>
        <div className="flex gap-3 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${destructive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
          >
            {destructive ? 'Remove' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [item, setItem]           = useState<CollectionItem | null>(null);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [loading, setLoading]     = useState(true);
  const [notes, setNotes]         = useState('');
  const [condition, setCondition] = useState('');
  const [forSale, setForSale]     = useState(false);
  const [askingPrice, setAskingPrice] = useState('');
  const [saving, setSaving]       = useState(false);
  const [saveOk, setSaveOk]       = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPostModal, setShowPostModal]     = useState(false);
  const [caption, setCaption]     = useState('');
  const [posting, setPosting]     = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await API.getCollectionItem(id);
        const it   = data.item;
        setItem(it);
        setNotes(it.notes ?? '');
        setCondition(it.condition ?? '');
        setForSale(it.for_sale ?? false);
        setAskingPrice(it.asking_price != null ? String(it.asking_price) : '');
        // Fetch live valuation in parallel
        if (it.card_id) {
          API.getValuation(it.card_id).then(v => setValuation(v.valuation)).catch(() => {});
        }
      } catch {
        setItem(null);
      }
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
        condition: condition || undefined,
        for_sale: forSale,
        asking_price: askingPrice ? parseFloat(askingPrice) : undefined,
      });
      setItem(res.item);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch {}
    setSaving(false);
  }

  async function handleDelete() {
    if (!item) return;
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

  const displayVal = valuation ?? {
    low_price:  item?.low_price,
    mid_price:  item?.mid_price,
    high_price: item?.high_price,
    sale_count: (item as CollectionItem & { sale_count?: number })?.sale_count,
  };

  const isRare = RARE_RE.test(item?.variant ?? '');

  if (loading) {
    return (
      <AuthGuard>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="h-6 w-24 rounded skeleton mb-6" />
          <div className="flex justify-center mb-6">
            <div className="w-48 rounded-2xl skeleton" style={{ aspectRatio: '63/88' }} />
          </div>
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-28 rounded-2xl skeleton" />)}
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!item) {
    return (
      <AuthGuard>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
          <div className="text-5xl">🃏</div>
          <p className="text-gray-500 text-base font-medium">Card not found.</p>
          <button onClick={() => router.back()} className="text-orange-500 font-semibold text-sm">← Go back</button>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-28 md:pb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-orange-500 mb-5 transition-colors font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Collection
        </button>

        {/* Card image */}
        <div className="flex justify-center mb-6">
          <div className="relative inline-block">
            {item.image_url ? (
              <>
                <img
                  src={item.image_url} alt={item.player_name ?? 'Card'}
                  className="rounded-2xl shadow-xl object-contain"
                  style={{ maxHeight: 380, maxWidth: '100%' }}
                />
                {isRare && <div className="absolute inset-0 rounded-2xl holo-overlay" />}
              </>
            ) : (
              <div
                className="w-52 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-gray-800 flex items-center justify-center shadow-lg"
                style={{ aspectRatio: '63/88' }}
              >
                <span className="text-6xl font-bold text-orange-300">
                  {item.player_name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? '?'}
                </span>
              </div>
            )}
            {isRare && (
              <div className="absolute -top-2 -right-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
                ★ Rare
              </div>
            )}
          </div>
        </div>

        {/* Identity */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl ring-1 ring-gray-100 dark:ring-gray-800 p-5 mb-4 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{item.player_name ?? 'Unknown'}</h1>
          {item.team && <p className="text-gray-500 mt-0.5 text-sm">{item.team}{item.position ? ` · ${item.position}` : ''}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.year     && <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-400 font-medium">{item.year}</span>}
            {item.set_name && <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-400">{item.set_name}</span>}
            {item.variant && item.variant !== 'Base' && (
              <span className="px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 rounded-full text-sm text-orange-600 dark:text-orange-400 font-medium">{item.variant}</span>
            )}
            {item.card_number && <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-500 font-mono">#{item.card_number}</span>}
          </div>
        </div>

        {/* Valuation */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl ring-1 ring-gray-100 dark:ring-gray-800 p-5 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Market Value</h2>
            {displayVal.sale_count != null && (
              <span className="text-xs text-gray-400">{displayVal.sale_count} eBay listings</span>
            )}
          </div>
          <div className="flex gap-2.5">
            <PriceBox label="Low"  value={displayVal.low_price} />
            <PriceBox label="Mid"  value={displayVal.mid_price} highlight />
            <PriceBox label="High" value={displayVal.high_price} />
          </div>
        </div>

        {/* Details editor */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl ring-1 ring-gray-100 dark:ring-gray-800 p-5 mb-4 shadow-sm space-y-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Details</h2>

          {/* Condition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Condition</label>
            <div className="flex flex-wrap gap-1.5">
              {CONDITIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setCondition(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    condition === c
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Personal notes, purchase details…"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none transition-shadow"
            />
          </div>

          {/* For sale toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">For Sale</p>
              <p className="text-xs text-gray-400">List this card as available</p>
            </div>
            <button
              onClick={() => setForSale(v => !v)}
              role="switch" aria-checked={forSale}
              className={`w-12 h-6 rounded-full transition-colors duration-200 relative focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${forSale ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${forSale ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {forSale && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Asking Price ($)</label>
              <input
                type="number" step="0.01" min="0" value={askingPrice}
                onChange={e => setAskingPrice(e.target.value)} placeholder="0.00"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-shadow"
              />
            </div>
          )}

          <button
            onClick={handleSave} disabled={saving}
            className={`w-full py-3 font-semibold rounded-2xl text-sm transition-all active:scale-[0.98] ${
              saveOk
                ? 'bg-green-500 text-white'
                : 'bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white shadow-sm shadow-orange-200 dark:shadow-none'
            }`}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </span>
            ) : saveOk ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => setShowPostModal(true)}
            className={`w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] ${
              postSuccess
                ? 'bg-green-500 text-white'
                : 'border border-orange-500 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'
            }`}
          >
            {postSuccess ? '✓ Shared to Feed' : 'Share to Feed'}
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full py-3 rounded-2xl border border-red-200 dark:border-red-900/40 text-red-500 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-[0.98]"
          >
            Remove from Collection
          </button>
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteModal && (
        <ConfirmModal
          message={`Remove ${item.player_name ?? 'this card'} from your collection? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {/* Share to feed */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPostModal(false)} />
          <div className="relative w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl shadow-2xl p-6 pb-8 animate-slide-up">
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4 md:hidden" />
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">Share to Feed</h3>
            <textarea
              value={caption} onChange={e => setCaption(e.target.value)}
              rows={3} placeholder="Say something about this card…"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none mb-4 transition-shadow"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowPostModal(false)}
                className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePost} disabled={posting}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-2xl text-sm transition-colors"
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
