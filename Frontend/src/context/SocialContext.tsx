import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { useData } from './DataContext';
import { apiFetch } from '../utils/api';

interface SocialContextType {
  followingIds: string[];
  followerCounts: Record<string, number>;
  toggleFollow: (id: string, currentFollowers?: number) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loadingSocial: boolean;
}

const SocialContext = createContext<SocialContextType | undefined>(undefined);

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { initialData } = useData();
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingSocial, setLoadingSocial] = useState(false);

  useEffect(() => {
    if (!user) {
      setFollowingIds([]);
      return;
    }

    if (initialData?.following) {
      setFollowingIds(initialData.following);
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
  }, [user, initialData]);

  const toggleFollow = async (targetId: string, currentCountOnUI: number = 0) => {
    if (!user || !targetId || user.id === targetId) return;

    const isFollowing = followingIds.includes(targetId);
    const originalFollowing = [...followingIds];
    const originalCounts = { ...followerCounts };

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
        await apiFetch('/api/queue-activity', {
          method: 'POST',
          body: JSON.stringify({ 
            type: 'FOLLOW', 
            payload: { targetId, action: 'unfollow' } 
          })
        }, user.id);
      } else {
        await apiFetch('/api/queue-activity', {
          method: 'POST',
          body: JSON.stringify({ 
            type: 'FOLLOW', 
            payload: { targetId, action: 'follow' } 
          })
        }, user.id);
      }
    } catch (err) {
      console.error('Error toggling follow in Supabase:', err);
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