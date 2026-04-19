import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';

interface SocialContextType {
  followingIds: string[];
  followerCounts: Record<string, number>;
  // FIXED: Made currentFollowers optional so it doesn't break other components
  toggleFollow: (id: string, currentFollowers?: number) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loadingSocial: boolean;
}

const SocialContext = createContext<SocialContextType | undefined>(undefined);

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingSocial, setLoadingSocial] = useState(false);

  useEffect(() => {
    if (!user) {
      setFollowingIds([]);
      return;
    }

    const fetchFollowing = async () => {
      setLoadingSocial(true);
      const { data, error } = await supabase
        .from('follows')
        .select('following_user_id')
        .eq('follower_id', user.id);

      if (!error && data) {
        setFollowingIds(data.map(f => f.following_user_id));
      }
      setLoadingSocial(false);
    };

    fetchFollowing();
  }, [user]);

  // FIXED: Defaulted currentCountOnUI to 0 if not provided
  const toggleFollow = async (targetId: string, currentCountOnUI: number = 0) => {
    if (!user || !targetId || user.id === targetId) return;

    const isFollowing = followingIds.includes(targetId);

    // Save original state for rollback
    const originalFollowing = [...followingIds];
    const originalCounts = { ...followerCounts };

    // 1. OPTIMISTIC UPDATE (Instant UI change)
    setFollowingIds(prev => isFollowing
      ? prev.filter(id => id !== targetId)
      : [...prev, targetId]
    );
    setFollowerCounts(prev => ({
      ...prev,
      [targetId]: (prev[targetId] ?? currentCountOnUI) + (isFollowing ? -1 : 1)
    }));

    try {
      if (isFollowing) {
        // Unfollow request to Supabase
        const { error } = await supabase
          .from('follows')
          .delete()
          .match({ follower_id: user.id, following_user_id: targetId });

        if (error) throw error;
      } else {
        // Follow request to Supabase
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_user_id: targetId });

        if (error) throw error;

        // Optional: Create Notification in Supabase
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', user.id)
          .maybeSingle();

        await supabase.from('notifications').insert({
          user_id: targetId,
          type: 'follow',
          sender_id: user.id,
          message: `${profile?.full_name || profile?.username || 'Someone'} started following you!`
        });
      }
    } catch (err) {
      console.error('Error toggling follow in Supabase:', err);
      // 2. ROLLBACK ON FAILURE
      setFollowingIds(originalFollowing);
      setFollowerCounts(originalCounts);
      showNotification('Error updating follow status. Please try again.', 'error');
    }
  };

  return (
    <SocialContext.Provider value={{ followingIds, followerCounts, toggleFollow, searchQuery, setSearchQuery, loadingSocial }}>
      {children}
    </SocialContext.Provider>
  );
}

export function useSocial() {
  const context = useContext(SocialContext);
  if (context === undefined) {
    throw new Error('useSocial must be used within a SocialProvider');
  }
  return context;
}