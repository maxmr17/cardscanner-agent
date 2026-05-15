'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import Avatar from '@/components/Avatar';
import { API, User } from '@/lib/api';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setUsers([]); setSearched(false); return; }
    setSearching(true);
    try {
      const data = await API.searchUsers(q);
      setUsers(data.users);
      setSearched(true);
    } catch {}
    setSearching(false);
  }, []);

  function handleChange(v: string) {
    setQuery(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(v), 300);
  }

  return (
    <AuthGuard>
      <div className="max-w-xl mx-auto px-4 py-6 pb-28 md:pb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Find Collectors</h1>

        <div className="relative mb-5">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder="Search by username or name…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {users.length > 0 ? (
          <div className="space-y-2">
            {users.map(user => (
              <Link
                key={user.id}
                href={`/users/${user.id}`}
                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-xl shadow hover:shadow-md transition-shadow"
              >
                <Avatar src={user.avatar_url} name={user.display_name ?? user.username} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user.display_name ?? user.username}</p>
                  <p className="text-xs text-gray-400">@{user.username}</p>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        ) : searched && query.length >= 2 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <p className="font-medium">No users found</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        ) : !searching && !searched ? (
          <div className="text-center py-16 text-gray-300 dark:text-gray-600">
            <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <p className="text-sm">Type at least 2 characters to search</p>
          </div>
        ) : null}
      </div>
    </AuthGuard>
  );
}
