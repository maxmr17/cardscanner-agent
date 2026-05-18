'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import Avatar from '@/components/Avatar';
import { API, User } from '@/lib/api';

function UserRow({ user }: { user: User }) {
  return (
    <Link
      href={`/users/${user.id}`}
      className="flex items-center gap-3 p-3.5 bg-white dark:bg-gray-900 rounded-2xl ring-1 ring-gray-100 dark:ring-gray-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
    >
      <Avatar src={user.avatar_url} name={user.display_name ?? user.username} size={46} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
          {user.display_name ?? user.username}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">@{user.username}</p>
      </div>
      <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}

function Prompt() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-4">
      <div className="grid grid-cols-3 gap-2 mb-2">
        {['🏈','⭐','🏆'].map((e, i) => (
          <div key={i} className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl">
            {e}
          </div>
        ))}
      </div>
      <p className="text-base font-bold text-gray-800 dark:text-gray-200">Find Collectors</p>
      <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
        Search by username or display name to discover collectors with great collections.
      </p>
    </div>
  );
}

export default function SearchPage() {
  const [query, setQuery]     = useState('');
  const [users, setUsers]     = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched]   = useState(false);
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
      <div className="max-w-xl mx-auto px-4 pt-5 pb-28 md:pb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Search</h1>

        {/* Search input */}
        <div className="relative mb-5">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text" value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder="Username or display name…"
            autoFocus
            className="w-full pl-10 pr-10 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm shadow-sm transition-shadow"
          />
          {searching ? (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          ) : query.length > 0 ? (
            <button
              onClick={() => { setQuery(''); setUsers([]); setSearched(false); }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>

        {/* Results */}
        {users.length > 0 ? (
          <div className="space-y-2 animate-fade-in">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              {users.length} result{users.length !== 1 ? 's' : ''}
            </p>
            {users.map(user => <UserRow key={user.id} user={user} />)}
          </div>
        ) : searched && query.length >= 2 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-700 dark:text-gray-300">No users found</p>
            <p className="text-sm text-gray-400">Try a different name or username</p>
          </div>
        ) : query.length === 1 ? (
          <p className="text-center text-sm text-gray-400 py-6">Type one more character to search…</p>
        ) : (
          <Prompt />
        )}
      </div>
    </AuthGuard>
  );
}
