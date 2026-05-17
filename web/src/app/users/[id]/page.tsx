'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { API, UserProfile, CollectionItem } from '@/lib/api';

function SkeletonProfile() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl ring-1 ring-gray-100 dark:ring-gray-800 overflow-hidden shadow-sm mb-5">
      <div className="h-20 skeleton" />
      <div className="px-5 pb-5 mt-2 space-y-3">
        <div className="h-6 w-40 rounded skeleton" />
        <div className="h-4 w-28 rounded skeleton" />
        <div className="grid grid-cols-3 gap-3 pt-3">
          {[1,2,3].map(i => <div key={i} className="h-10 rounded-xl skeleton" />)}
        </div>
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  const params  = useParams();
  const router  = useRouter();
  const { user: me } = useAuth();
  const userId  = params.id as string;

  const [profile, setProfile]   = useState<UserProfile | null>(null);
  const [items, setItems]       = useState<CollectionItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [profileData, collectionData] = await Promise.all([
          API.getUserProfile(userId),
          API.getUserCollection(userId),
        ]);
        setProfile(profileData.profile);
        setItems(collectionData.items);
      } catch {}
      setLoading(false);
    }
    load();
  }, [userId]);

  async function toggleFollow() {
    if (!profile) return;
    setToggling(true);
    try {
      if (profile.is_following) {
        await API.unfollowUser(userId);
        setProfile(p => p ? { ...p, is_following: false, follower_count: p.follower_count - 1 } : p);
      } else {
        await API.followUser(userId);
        setProfile(p => p ? { ...p, is_following: true, follower_count: p.follower_count + 1 } : p);
      }
    } catch {}
    setToggling(false);
  }

  const isMe = me?.id === userId;

  return (
    <AuthGuard>
      <div className="max-w-3xl mx-auto px-4 pt-5 pb-28 md:pb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-orange-500 mb-5 transition-colors font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {loading ? (
          <>
            <SkeletonProfile />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-card rounded-xl skeleton" />
              ))}
            </div>
          </>
        ) : !profile ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
            <p className="text-base font-medium text-gray-700 dark:text-gray-300">User not found.</p>
            <button onClick={() => router.back()} className="text-orange-500 font-semibold text-sm">← Go back</button>
          </div>
        ) : (
          <>
            {/* Profile card */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl ring-1 ring-gray-100 dark:ring-gray-800 overflow-hidden shadow-sm mb-5">
              <div className="h-16 bg-gradient-to-r from-indigo-400 to-purple-500" />
              <div className="px-5 pb-5">
                <div className="flex items-end justify-between -mt-8 mb-3">
                  <Avatar src={profile.avatar_url} name={profile.display_name ?? profile.username} size={64} className="ring-4 ring-white dark:ring-gray-900 rounded-2xl" />
                  {!isMe && (
                    <button
                      onClick={toggleFollow} disabled={toggling}
                      className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 ${
                        profile.is_following
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm shadow-orange-200 dark:shadow-none'
                      }`}
                    >
                      {toggling ? '…' : profile.is_following ? 'Unfollow' : 'Follow'}
                    </button>
                  )}
                </div>

                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                  {profile.display_name ?? profile.username}
                </h1>
                <p className="text-sm text-gray-400">@{profile.username}</p>
                {profile.bio && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{profile.bio}</p>}

                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800 text-center">
                  {[
                    ['Cards',     profile.card_count],
                    ['Followers', profile.follower_count],
                    ['Following', profile.following_count],
                  ].map(([label, value]) => (
                    <div key={label as string} className="px-2">
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Collection */}
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Collection</h2>

            {items.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">
                {profile.is_public === false ? 'This collection is private.' : 'No cards yet.'}
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="aspect-card bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-default"
                    title={[item.player_name, item.year, item.set_name].filter(Boolean).join(' · ')}
                  >
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.player_name ?? ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/20 dark:to-gray-800">
                        <span className="text-lg font-bold text-indigo-300">
                          {item.player_name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? '?'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AuthGuard>
  );
}
