import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useData } from './DataContext';
import { supabase } from '../utils/supabase';
import { compressImage } from '../utils/imageCompressor';
import { apiFetch, API_BASE_URL } from '../utils/api';
import { socket } from '../utils/socket';

export interface PostData {
  id: string;
  author: { id: string; name: string; handle: string; avatar: string; };
  content: string;
  timestamp: string;
  created_at: string;
  likes: number;
  comments: number;
  reposts: number;
  isLiked?: boolean;
  isReposted?: boolean;
  is_edited?: boolean;
  image?: string | null;
  location?: string | null;
  reposted_post_id?: string | null;
  original_post?: PostData | null;
  author_id?: string;
}

export interface CommentData {
  id: string;
  author: { id: string; name: string; handle: string; avatar: string; };
  content: string;
  created_at: string;
}

interface PostContextType {
  posts: PostData[];
  addPost: (content: string, userId: string, image?: string | null, location?: string | null, reposted_post_id?: string | null) => Promise<void>;
  editPost: (postId: string, newContent: string) => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  toggleRepost: (postId: string) => Promise<void>;
  quoteRepost: (postId: string, content: string, image?: string | null, location?: string | null) => Promise<void>;
  addComment: (postId: string, content: string) => Promise<void>;
  getComments: (postId: string) => Promise<CommentData[]>;
  sharePost: (postId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  refreshPosts: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const PostContext = createContext<PostContextType | undefined>(undefined);

const getLocalCache = () => {
  try {
    const data = localStorage.getItem('social_cache_v2');
    return data ? JSON.parse(data) : {};
  } catch { return {}; }
};

const setLocalCache = (cache: any) => {
  localStorage.setItem('social_cache_v2', JSON.stringify(cache));
};

export default function PostProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { initialData } = useData();

  const pendingActions = useRef<{ userId: string; type: string; payload: any }[]>([]);
  const batchTimeout = useRef<any>(null);
  const postsRef = useRef<PostData[]>([]);

  useEffect(() => { postsRef.current = posts; }, [posts]);

  const applyCache = useCallback((serverPosts: PostData[]) => {
    const cache = getLocalCache();
    const now = Date.now();
    return serverPosts.map(post => {
      const cached = cache[post.id];
      if (cached && (now - cached.ts < 600000)) { 
        return {
          ...post,
          likes: Math.max(0, post.likes + (cached.likedDelta || 0)),
          isLiked: cached.isLiked ?? post.isLiked,
          comments: post.comments + (cached.commentDelta || 0),
          reposts: Math.max(0, post.reposts + (cached.repostDelta || 0)),
          isReposted: cached.isReposted ?? post.isReposted
        };
      }
      return post;
    });
  }, []);

  const flushBatch = useCallback(async () => {
    if (pendingActions.current.length === 0 || !user) return;
    const actionsToSend = [...pendingActions.current];
    pendingActions.current = [];
    try {
      await apiFetch('/api/queue-activity', {
        method: 'POST',
        body: JSON.stringify({ type: 'BATCH', payload: { events: actionsToSend }, userId: user.id })
      }, user.id);
      setTimeout(() => {
        const cache = getLocalCache();
        actionsToSend.forEach(a => { if (a.payload.postId) delete cache[a.payload.postId]; });
        setLocalCache(cache);
      }, 30000);
    } catch (err) { console.error(err); }
  }, [user]);

  const queueAction = useCallback((type: string, payload: any) => {
    if (!user) return;
    pendingActions.current.push({ userId: user.id, type, payload });
    const cache = getLocalCache();
    const postId = payload.postId;
    if (postId) {
      if (!cache[postId]) cache[postId] = { ts: Date.now(), likedDelta: 0, repostDelta: 0, commentDelta: 0 };
      cache[postId].ts = Date.now();
      if (type === 'LIKE') {
        const isRemoving = payload.action === 'remove';
        cache[postId].isLiked = !isRemoving;
        cache[postId].likedDelta = (cache[postId].likedDelta || 0) + (isRemoving ? -1 : 1);
      }
      if (type === 'COMMENT') cache[postId].commentDelta = (cache[postId].commentDelta || 0) + 1;
      if (type === 'REPOST') {
        const isRemoving = payload.action === 'remove';
        cache[postId].isReposted = !isRemoving;
        cache[postId].repostDelta = (cache[postId].repostDelta || 0) + (isRemoving ? -1 : 1);
      }
      setLocalCache(cache);
    }
    if (batchTimeout.current) clearTimeout(batchTimeout.current);
    batchTimeout.current = setTimeout(flushBatch, 10000);
  }, [user, flushBatch]);

  useEffect(() => {
    const handleUnload = () => {
      if (pendingActions.current.length > 0 && user) {
        navigator.sendBeacon(`${API_BASE_URL}/api/queue-activity`, JSON.stringify({ type: 'BATCH', payload: { events: pendingActions.current }, userId: user.id }));
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    
    // Real-time Activity Listener
    socket.on('activity_update', (data: { userId: string; type: string; payload: any }) => {
      if (data.userId === user?.id) return; // Skip our own actions as they are handled locally
      
      setPosts(prev => prev.map(p => {
        if (p.id !== data.payload.postId) return p;
        
        const newPost = { ...p };
        if (data.type === 'LIKE') {
          newPost.likes = Math.max(0, p.likes + (data.payload.action === 'remove' ? -1 : 1));
        } else if (data.type === 'REPOST') {
          newPost.reposts = Math.max(0, p.reposts + (data.payload.action === 'remove' ? -1 : 1));
        } else if (data.type === 'COMMENT') {
          newPost.comments = p.comments + 1;
        }
        return newPost;
      }));
    });

    socket.on('new_post', (post) => {
      console.log('socket new_post', post);
      
      const newPost = {
        id: post.id,
        author: { id: post.author_id, name: post.author?.full_name, handle: post.author?.username, avatar: post.author?.avatar_url },
        content: post.content,
        timestamp: 'Just now',
        created_at: post.created_at,
        likes: 0,
        comments: 0,
        reposts: 0,
        isLiked: false,
        isReposted: false,
        image: post.image_url || post.image,
        location: post.location
      };

      setPosts(prev => {
        // Remove optimistic UI post that matches this content
        const filtered = prev.filter(p => !(p.id.startsWith('temp-') && p.content === newPost.content));
        
        // Prevent adding duplicate if it already exists
        if (filtered.some(p => p.id === newPost.id)) return filtered;
        
        return [newPost, ...filtered];
      });
    });

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      socket.off('activity_update');
      socket.off('new_post');
    };
  }, [user]);

  const fetchPosts = useCallback(async () => {
    if (initialData?.posts && posts.length === 0) {
      setPosts(applyCache(initialData.posts));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch('/api/posts', { method: 'GET' }, user?.id);
      if (response && Array.isArray(response)) {
        const mapped = response.map((post: any) => ({
          id: post.id,
          author: { id: post.author_id, name: post.author?.full_name, handle: post.author?.username, avatar: post.author?.avatar_url },
          content: post.content, 
          timestamp: new Date(post.created_at).toLocaleString(), 
          created_at: post.created_at,
          likes: post.likes_count || 0, 
          comments: post.comments_count || 0, 
          reposts: post.reposts_count || 0,
          isLiked: post.isLiked || false, 
          isReposted: post.isReposted || false,
          image: post.image, 
          location: post.location, 
          reposted_post_id: post.reposted_post_id
        }));
        setPosts(applyCache(mapped));
      }
    } catch (err) { setError("Failed to fetch posts"); }
    finally { setLoading(false); }
  }, [user, initialData, applyCache]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const getComments = useCallback(async (postId: string) => {
    try {
      const response = await apiFetch(`/api/posts/${postId}/comments`, { method: 'GET' }, user?.id);
      return response || [];
    } catch (err) {
      console.error('Failed to get comments:', err);
      return [];
    }
  }, [user]);

  const toggleLike = useCallback(async (postId: string) => {
    if (!user) return;
    const post = postsRef.current.find(p => p.id === postId);
    if (!post) return;
    const isCurrentlyLiked = post.isLiked;
    const action = isCurrentlyLiked ? 'remove' : 'add';
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, isLiked: !isCurrentlyLiked, likes: p.likes + (isCurrentlyLiked ? -1 : 1) } : p));
    queueAction('LIKE', { postId, action });
  }, [user, queueAction]);

  const toggleRepost = useCallback(async (postId: string) => {
    if (!user) return;
    const post = postsRef.current.find(p => p.id === postId);
    if (!post) return;
    const isCurrentlyReposted = post.isReposted;
    const action = isCurrentlyReposted ? 'remove' : 'add';
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, isReposted: !isCurrentlyReposted, reposts: p.reposts + (isCurrentlyReposted ? -1 : 1) } : p));
    queueAction('REPOST', { postId, action });
  }, [user, queueAction]);

  const addComment = useCallback(async (postId: string, content: string) => {
    if (!user || !content.trim()) return;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments + 1 } : p));
    
    // Comments should save instantly, so we bypass the queue
    try {
      await apiFetch('/api/queue-activity', { 
        method: 'POST', 
        body: JSON.stringify({ 
          type: 'COMMENT', 
          payload: { postId, content } 
        }) 
      }, user.id);
    } catch (err) {
      console.error('Failed to save comment instantly:', err);
    }
  }, [user]);

  const addPost = useCallback(async (content: string, userId: string, image?: string | null, location?: string | null) => {
    if (!user) return;

    // 1. Create an Optimistic Post (Visible Instantly)
    const optimisticPost: PostData = {
      id: `temp-${Date.now()}`,
      author: {
        id: user.id,
        name: user.user_metadata?.full_name || user.user_metadata?.username || 'You',
        handle: user.user_metadata?.username || 'user',
        avatar: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`
      },
      content: content,
      timestamp: 'Just now',
      created_at: new Date().toISOString(),
      likes: 0,
      comments: 0,
      reposts: 0,
      isLiked: false,
      isReposted: false,
      image: image,
      location: location,
      author_id: user.id
    };

    // 2. Update UI immediately
    setPosts(prev => [optimisticPost, ...prev]);

    let finalImageUrl = image;
    if (image && image.startsWith("blob:")) {
      try {
        const blob = await fetch(image).then(r => r.blob());
        const compressed = await compressImage(new File([blob], "image.jpg", { type: "image/jpeg" }));
        const path = `${userId}/${Date.now()}.jpg`;
        await supabase.storage.from("posts").upload(path, compressed);
        finalImageUrl = supabase.storage.from("posts").getPublicUrl(path).data.publicUrl;
      } catch (e) { console.error("Image upload failed", e); }
    }

    try {
      await apiFetch('/api/queue-activity', { 
        method: 'POST', 
        body: JSON.stringify({ 
          type: 'POST', 
          payload: { content, image: finalImageUrl, location } 
        }) 
      }, userId);
      
      // We no longer call fetchPosts() here because the socket.on('new_post') 
      // will handle the update instantly and safely.
    } catch (err) {
      console.error('Failed to post:', err);
      // Rollback on error
      setPosts(prev => prev.filter(p => p.id !== optimisticPost.id));
    }
  }, [user, fetchPosts]);

  return (
    <PostContext.Provider value={{
      posts, addPost, toggleLike, toggleRepost, addComment, getComments, refreshPosts: fetchPosts, loading, error,
      editPost: async () => {}, deletePost: async () => {}, quoteRepost: async () => {}, sharePost: async () => {}
    }}>
      {children}
    </PostContext.Provider>
  );
}

export const usePosts = () => {
  const context = useContext(PostContext);
  if (!context) throw new Error("usePosts must be used within a PostProvider");
  return context;
};
