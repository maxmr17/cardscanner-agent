'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import FeedPost from '@/components/FeedPost';
import { API, Post } from '@/lib/api';

function SkeletonPost() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl ring-1 ring-gray-100 dark:ring-gray-800 overflow-hidden shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full skeleton flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-28 rounded-full skeleton" />
          <div className="h-2.5 w-20 rounded-full skeleton" />
        </div>
      </div>
      <div className="h-52 rounded-xl skeleton" />
      <div className="space-y-2">
        <div className="h-3 w-36 rounded-full skeleton" />
        <div className="h-2.5 w-24 rounded-full skeleton" />
      </div>
      <div className="flex gap-3 pt-1">
        <div className="h-8 w-16 rounded-xl skeleton" />
        <div className="h-8 w-16 rounded-xl skeleton" />
      </div>
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-center px-6">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-gray-800 flex items-center justify-center">
        <svg className="w-10 h-10 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <div>
        <p className="text-base font-bold text-gray-800 dark:text-gray-200">Your feed is empty</p>
        <p className="text-sm text-gray-400 mt-1 leading-relaxed max-w-xs">
          Follow collectors to see their cards here, or share a card from your own collection.
        </p>
      </div>
      <div className="flex flex-col gap-2.5 w-full max-w-xs">
        <Link
          href="/search"
          className="py-3 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-sm font-semibold rounded-2xl transition-all text-center"
        >
          Find Collectors →
        </Link>
        <Link
          href="/collection"
          className="py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
        >
          Share a Card
        </Link>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [posts, setPosts]     = useState<Post[]>([]);
  const [page, setPage]       = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [skeletal, setSkeletal] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await API.getFeed(p);
      setPosts(prev => p === 1 ? data.posts : [...prev, ...data.posts]);
      setHasMore(data.has_more);
    } catch {}
    setLoading(false);
    setSkeletal(false);
  }, []);

  useEffect(() => { loadPage(1); }, [loadPage]);

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
      <div className="max-w-xl mx-auto px-4 pt-5 pb-28 md:pb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-5">Feed</h1>

        {skeletal ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonPost key={i} />)}
          </div>
        ) : posts.length === 0 ? (
          <EmptyFeed />
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <FeedPost key={post.id} post={post} onDelete={handleDelete} />
            ))}
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
