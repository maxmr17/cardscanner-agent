'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Post, Comment, API } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Avatar from './Avatar';

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatPrice(v?: number | null) {
  if (v == null) return null;
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`;
}

function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xs p-6 animate-scale-in">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-5">
          Delete this post? This can&apos;t be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface FeedPostProps {
  post: Post;
  onDelete?: (id: string) => void;
}

export default function FeedPost({ post: initialPost, onDelete }: FeedPostProps) {
  const { user } = useAuth();
  const [post, setPost]               = useState(initialPost);
  const [showComments, setShowComments]         = useState(false);
  const [comments, setComments]       = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment]   = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  async function toggleLike() {
    const wasLiked = post.liked_by_me;
    setPost(p => ({ ...p, liked_by_me: !wasLiked, like_count: p.like_count + (wasLiked ? -1 : 1) }));
    if (!wasLiked) {
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 500);
    }
    try {
      if (wasLiked) await API.unlikePost(post.id);
      else           await API.likePost(post.id);
    } catch {
      setPost(p => ({ ...p, liked_by_me: wasLiked, like_count: p.like_count + (wasLiked ? 1 : -1) }));
    }
  }

  async function toggleComments() {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const data = await API.getComments(post.id);
        setComments(data.comments);
      } catch {}
      setLoadingComments(false);
    }
    setShowComments(v => !v);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const content = newComment.trim();
    if (!content) return;
    setSubmitting(true);
    try {
      const data = await API.createComment(post.id, content);
      setComments(c => [...c, data.comment]);
      setPost(p => ({ ...p, comment_count: p.comment_count + 1 }));
      setNewComment('');
    } catch {}
    setSubmitting(false);
  }

  async function handleDelete() {
    try {
      await API.deletePost(post.id);
      onDelete?.(post.id);
    } catch {}
    setShowDeleteModal(false);
  }

  async function handleDeleteComment(id: string) {
    try {
      await API.deleteComment(id);
      setComments(c => c.filter(cm => cm.id !== id));
      setPost(p => ({ ...p, comment_count: Math.max(0, p.comment_count - 1) }));
    } catch {}
  }

  const isOwn    = user?.id === post.user_id;
  const midPrice = formatPrice(post.mid_price);

  return (
    <>
      <article className="bg-white dark:bg-gray-900 rounded-2xl ring-1 ring-gray-100 dark:ring-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <Link href={`/users/${post.user_id}`} className="flex items-center gap-3 group">
            <Avatar src={post.avatar_url} name={post.display_name ?? post.username} size={38} />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-orange-500 transition-colors leading-none">
                {post.display_name ?? post.username}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">@{post.username} · {formatRelative(post.created_at)}</p>
            </div>
          </Link>
          {isOwn && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              aria-label="Delete post"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

        {/* Card image */}
        {post.image_url && (
          <div className="bg-gray-50 dark:bg-gray-800 mx-3 rounded-xl overflow-hidden mb-3">
            <img
              src={post.image_url} alt={post.player_name ?? 'Card'}
              className="w-full max-h-80 object-contain"
            />
          </div>
        )}

        {/* Card info + caption */}
        <div className="px-4 pb-1">
          {(post.player_name || midPrice) && (
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className="min-w-0">
                {post.player_name && (
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{post.player_name}</p>
                )}
                {(post.year || post.set_name || post.variant) && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {[post.year, post.set_name, post.variant].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              {midPrice && (
                <span className="text-sm font-bold text-orange-500 whitespace-nowrap tabular-nums flex-shrink-0">{midPrice}</span>
              )}
            </div>
          )}
          {post.caption && (
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{post.caption}</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-3 py-2.5 flex items-center gap-1.5">
          <button
            onClick={toggleLike}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
              post.liked_by_me
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <svg
              className={`w-5 h-5 transition-transform ${likeAnimating ? 'animate-bounce-heart' : ''}`}
              fill={post.liked_by_me ? 'currentColor' : 'none'}
              stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <span className="tabular-nums">{post.like_count}</span>
          </button>

          <button
            onClick={toggleComments}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
              showComments
                ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
            </svg>
            <span className="tabular-nums">{post.comment_count}</span>
          </button>
        </div>

        {/* Comments */}
        {showComments && (
          <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-3">
            {loadingComments ? (
              <div className="flex justify-center py-3">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No comments yet — be first!</p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex gap-2.5 group">
                  <Avatar src={c.avatar_url} name={c.display_name ?? c.username} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 leading-none mb-0.5">{c.display_name ?? c.username}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{c.content}</p>
                  </div>
                  {user?.id === c.user_id && (
                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 rounded flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}
            <form onSubmit={submitComment} className="flex gap-2 pt-1">
              <input
                type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 text-sm px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-shadow"
              />
              <button
                type="submit" disabled={!newComment.trim() || submitting}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl transition-colors"
                aria-label="Post comment"
              >
                {submitting
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                }
              </button>
            </form>
          </div>
        )}
      </article>

      {showDeleteModal && (
        <DeleteModal onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)} />
      )}
    </>
  );
}
