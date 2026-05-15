'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import AuthGuard from '@/components/AuthGuard';
import FeedPost from '@/components/FeedPost';
import { API, Post } from '@/lib/api';

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await API.getFeed(p);
      setPosts(prev => p === 1 ? data.posts : [...prev, ...data.posts]);
      setHasMore(data.has_more);
    } catch {}
    setLoading(false);
    setInitial(false);
  }, []);

  useEffect(() => { loadPage(1); }, [loadPage]);

  // Infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const next = page + 1;
        setPage(next);
        loadPage(next);
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, page, loadPage]);

  function handleDelete(id: string) {
    setPosts(p => p.filter(post => post.id !== id));
  }

  return (
    <AuthGuard>
      <div className="max-w-xl mx-auto px-4 py-6 pb-28 md:pb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5">Feed</h1>

        {initial && loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="font-medium">No posts yet</p>
            <p className="text-sm mt-1">Follow collectors to see their posts here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <FeedPost key={post.id} post={post} onDelete={handleDelete} />
            ))}
          </div>
        )}

        <div ref={loaderRef} className="py-4 flex justify-center">
          {loading && !initial && (
            <div className="w-6 h-6 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
