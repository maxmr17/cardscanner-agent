'use client';

import { useState } from 'react';
import { Post, Comment, API } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Avatar from './Avatar';

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString();
}

function formatPrice(v?: number | null) {
  return v != null ? `$${v.toFixed(2)}` : null;
}

interface FeedPostProps {
  post: Post;
  onDelete?: (id: string) => void;
}

export default function FeedPost({ post: initialPost, onDelete }: FeedPostProps) {
  const { user } = useAuth();
  const [post, setPost] = useState(initialPost);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  async function toggleLike() {
    const wasLiked = post.liked_by_me;
    setPost(p => ({ ...p, liked_by_me: !wasLiked, like_count: p.like_count + (wasLiked ? -1 : 1) }));
    try {
      if (wasLiked) await API.unlikePost(post.id);
      else await API.likePost(post.id);
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
    setSubmittingComment(true);
    try {
      const data = await API.createComment(post.id, content);
      setComments(c => [...c, data.comment]);
      setPost(p => ({ ...p, comment_count: p.comment_count + 1 }));
      setNewComment('');
    } catch {}
    setSubmittingComment(false);
  }

  async function handleDelete() {
    if (!confirm('Delete this post?')) return;
    try {
      await API.deletePost(post.id);
      onDelete?.(post.id);
    } catch {}
  }

  const isOwn = user?.id === post.user_id;
  const midPrice = formatPrice(post.mid_price);

  return (
    <article className="bg-white dark:bg-gray-900 rounded-xl shadow overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <Avatar src={post.avatar_url} name={post.display_name ?? post.username} size={36} />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-none">
              {post.display_name ?? post.username}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">@{post.username} · {formatRelative(post.created_at)}</p>
          </div>
        </div>
        {isOwn && (
          <button onClick={handleDelete} className="text-gray-400 hover:text-red-500 transition-colors p-1" aria-label="Delete post">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Card image */}
      {post.image_url && (
        <div className="bg-gray-100 dark:bg-gray-800">
          <img src={post.image_url} alt={post.player_name ?? 'Card'} className="w-full max-h-96 object-contain" />
        </div>
      )}

      {/* Card info */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            {post.player_name && <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{post.player_name}</p>}
            {(post.year || post.set_name) && (
              <p className="text-xs text-gray-500">{[post.year, post.set_name, post.variant].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          {midPrice && (
            <span className="text-sm font-semibold text-orange-500">{midPrice}</span>
          )}
        </div>
        {post.caption && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{post.caption}</p>}
      </div>

      {/* Actions */}
      <div className="px-4 pb-3 flex items-center gap-5">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${post.liked_by_me ? 'text-red-500' : 'text-gray-500 dark:text-gray-400 hover:text-red-500'}`}
        >
          <svg className="w-5 h-5" fill={post.liked_by_me ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          {post.like_count}
        </button>
        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
          </svg>
          {post.comment_count}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-3">
          {loadingComments ? (
            <div className="flex justify-center py-2">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No comments yet</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="flex gap-2">
                <Avatar src={c.avatar_url} name={c.display_name ?? c.username} size={28} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{c.display_name ?? c.username}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{c.content}</p>
                </div>
              </div>
            ))
          )}
          <form onSubmit={submitComment} className="flex gap-2 pt-1">
            <input
              type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <button
              type="submit" disabled={!newComment.trim() || submittingComment}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Post
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
