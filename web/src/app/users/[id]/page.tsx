'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { API, UserProfile, CollectionItem } from '@/lib/api';

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: me } = useAuth();
  const userId = params.id as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex justify-center items-center min-h-screen">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AuthGuard>
    );
  }

  if (!profile) {
    return (
      <AuthGuard>
        <div className="flex flex-col items-center justify-center min-h-screen gap-3">
          <p className="text-gray-500">User not found.</p>
          <button onClick={() => router.back()} className="text-orange-500 font-medium text-sm">Go back</button>
        </div>
      </AuthGuard>
    );
  }

  const isMe = me?.id === userId;

  return (
    <AuthGuard>
      <div className="max-w-3xl mx-auto px-4 py-6 pb-28 md:pb-6">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-orange-500 mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Profile header */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-5 mb-5">
          <div className="flex items-center gap-4">
            <Avatar src={profile.avatar_url} name={profile.display_name ?? profile.username} size={64} />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{profile.display_name ?? profile.username}</h1>
              <p className="text-sm text-gray-400">@{profile.username}</p>
              {profile.bio && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{profile.bio}</p>}
            </div>
            {!isMe && (
              <button
                onClick={toggleFollow} disabled={toggling}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
                  profile.is_following
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}
              >
                {profile.is_following ? 'Unfollow' : 'Follow'}
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            {[
              ['Cards', profile.card_count],
              ['Followers', profile.follower_count],
              ['Following', profile.following_count],
            ].map(([label, value]) => (
              <div key={label as string} className="text-center">
                <p className="text-base font-bold text-gray-900 dark:text-gray-100">{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Collection */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Collection</h2>

        {items.length === 0 ? (
          <p className="text-center text-gray-400 py-12">{profile.is_public === false ? 'This collection is private.' : 'No cards yet.'}</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {items.map(item => (
              <div key={item.id} className="aspect-[63/88] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.player_name ?? ''} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-gray-800">
                    <span className="text-lg font-bold text-orange-300">
                      {item.player_name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? '?'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
