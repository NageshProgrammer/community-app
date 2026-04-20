import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useData } from './DataContext';
import { supabase } from '../utils/supabase';
import { compressImage } from '../utils/imageCompressor';

export interface PostData {
  id: string;
  author: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
  };
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
  author: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
  };
  content: string;
  created_at: string;
}

interface PostContextType {
  posts: PostData[];
  addPost: (
    content: string,
    userId: string,
    image?: string | null,
    location?: string | null,
    reposted_post_id?: string | null,
  ) => Promise<void>;
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

export function PostProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { initialData } = useData();

  const hasInitialized = useRef(false);

  const fetchPosts = useCallback(async () => {
    // If we have initial data from bootstrap, use it immediately (only once)
    if (initialData?.posts && !hasInitialized.current) {
      setPosts(initialData.posts);
      setLoading(false);
      hasInitialized.current = true;
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("posts")
        .select(`
          *,
          author:profiles!author_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          likes:post_likes!post_id(count),
          comments:post_comments!post_id(count),
          reposts:post_reposts!post_id(count)
        `)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const likedResponse = user
        ? await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", user.id)
        : { data: [] };
      const repostedResponse = user
        ? await supabase
          .from("post_reposts")
          .select("post_id")
          .eq("user_id", user.id)
        : { data: [] };

      const likedIds = likedResponse.data?.map((item: any) => item.post_id) ?? [];
      const repostedIds = repostedResponse.data?.map((item: any) => item.post_id) ?? [];

      if (data && data.length > 0) {
        const repostIdsToFetch = data
          .filter((p) => p.reposted_post_id)
          .map((p) => p.reposted_post_id);

        const { data: originalPostsData } = repostIdsToFetch.length > 0
          ? await supabase.from('posts').select(`
              *, 
              author:profiles!author_id(*),
              likes:post_likes!post_id(count),
              comments:post_comments!post_id(count),
              reposts:post_reposts!post_id(count)
            `).in("id", repostIdsToFetch)
          : { data: [] };

        const mappedPosts: PostData[] = (data as any[]).map((post) => {
          const profile = Array.isArray(post.author) ? post.author[0] : post.author;

          let originalPost = null;
          if (post.reposted_post_id) {
            const orig = originalPostsData?.find(p => p.id === post.reposted_post_id);
            if (orig) {
              originalPost = {
                id: orig.id,
                author: {
                  id: orig.author_id,
                  name: orig.author?.full_name || 'User',
                  handle: orig.author?.username || 'user',
                  avatar: orig.author?.avatar_url || ''
                },
                content: orig.content,
                timestamp: new Date(orig.created_at).toLocaleString(),
                created_at: orig.created_at,
                likes: orig.likes?.[0]?.count || 0,
                comments: orig.comments?.[0]?.count || 0,
                reposts: orig.reposts?.[0]?.count || 0,
                image: orig.image
              };
            }
          }

          return {
            id: post.id,
            author: {
              id: post.author_id,
              name: profile?.full_name || (post.author_id === user?.id ? user?.user_metadata?.full_name || "My User" : "User"),
              handle: profile?.username || post.author_id.substring(0, 5),
              avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author_id}`,
            },
            content: post.content,
            timestamp: new Date(post.created_at).toLocaleString(),
            created_at: post.created_at,
            likes: post.likes?.[0]?.count || 0,
            comments: post.comments?.[0]?.count || 0,
            reposts: post.reposts?.[0]?.count || 0,
            isLiked: likedIds.includes(post.id),
            isReposted: repostedIds.includes(post.id),
            image: post.image || null,
            location: post.location || null,
            reposted_post_id: post.reposted_post_id,
            is_edited: post.is_edited || false,
            original_post: originalPost,
          };
        });
        setPosts(mappedPosts);
      } else {
        setPosts([]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch posts";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, initialData]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const addPost = useCallback(
    async (
      content: string,
      userId: string,
      image?: string | null,
      location?: string | null,
      reposted_post_id?: string | null,
    ) => {
      if (!userId) return;
      let publicImageUrl = null;
      try {
        if (image && image.startsWith("blob:")) {
          const imageBlobOriginal = await fetch(image).then((r) => r.blob());
          // Convert Blob to File for the compressor
          const imageFile = new File([imageBlobOriginal], "post-image.jpg", { type: "image/jpeg" });
          const compressedBlob = await compressImage(imageFile);
          
          const fileName = `${userId}/${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage.from("posts").upload(fileName, compressedBlob);
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from("posts").getPublicUrl(fileName);
          publicImageUrl = urlData.publicUrl;
        }

        const { data, error: insertError } = await supabase
          .from("posts")
          .insert({
            author_id: userId,
            content,
            title: content.substring(0, 50).trim(),
            image: publicImageUrl,
            location: location || null,
            reposted_post_id: reposted_post_id || null,
          })
          .select();

        if (insertError) throw insertError;
        if (!data || data.length === 0) throw new Error("Failed to create post");

        const { data: profileData } = await supabase.from("profiles").select("username, full_name, avatar_url").eq("id", userId).single();

        const mappedPost: PostData = {
          id: data[0].id,
          author: {
            id: userId,
            name: profileData?.full_name || "Anonymous User",
            handle: profileData?.username || userId.substring(0, 5),
            avatar: profileData?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
          },
          content: data[0].content,
          timestamp: "Just now",
          created_at: new Date().toISOString(),
          likes: 0,
          comments: 0,
          reposts: 0,
          isLiked: false,
          isReposted: false,
          is_edited: false,
          image: publicImageUrl,
          location: location || null,
          reposted_post_id: reposted_post_id,
          original_post: reposted_post_id ? posts.find((p) => p.id === reposted_post_id) : null,
        };

        setPosts((prev) => [mappedPost, ...prev]);
      } catch (err) {
        console.error("Error creating post:", err);
      }
    },
    [posts],
  );

  const editPost = useCallback(
    async (postId: string, newContent: string) => {
      if (!user) return;
      try {
        const { error } = await supabase
          .from("posts")
          .update({ content: newContent, is_edited: true })
          .eq("id", postId)
          .eq("author_id", user.id);

        if (error) throw error;

        setPosts((prev) =>
          prev.map((p) => p.id === postId ? { ...p, content: newContent, is_edited: true } : p)
        );
      } catch (err) {
        console.error("Error editing post:", err);
        throw err;
      }
    },
    [user],
  );

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!user) return;
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      if (post.isLiked) {
        await supabase.from("post_likes").delete().match({ post_id: postId, user_id: user.id });
      } else {
        await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
        if (user.id !== post.author.id) {
          const { data: profile } = await supabase.from("profiles").select("full_name, username").eq("id", user.id).single();
          await supabase.from("notifications").insert({
            user_id: post.author.id,
            type: "like",
            sender_id: user.id,
            message: `${profile?.full_name || profile?.username || "Someone"} liked your post!`,
          });
        }
      }

      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, isLiked: !p.isLiked, likes: p.likes + (p.isLiked ? -1 : 1) } : p)
      );
    },
    [user, posts],
  );

  const toggleRepost = useCallback(
    async (postId: string) => {
      if (!user) return;
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      if (post.isReposted) {
        await supabase.from("post_reposts").delete().match({ post_id: postId, user_id: user.id });
      } else {
        await supabase.from("post_reposts").insert({ post_id: postId, user_id: user.id });
      }
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, isReposted: !p.isReposted, reposts: p.reposts + (p.isReposted ? -1 : 1) } : p)
      );
    },
    [user, posts],
  );

  const quoteRepost = useCallback(
    async (postId: string, content: string, image?: string | null, location?: string | null) => {
      if (!user) return;
      await addPost(content, user.id, image, location, postId);
    },
    [user, addPost],
  );

  const addComment = useCallback(
    async (postId: string, content: string) => {
      if (!user || !content.trim()) return;
      const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, content });
      if (error) throw error;

      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, comments: p.comments + 1 } : p)
      );

      const post = posts.find((p) => p.id === postId);
      if (post && user.id !== post.author.id) {
        const { data: profile } = await supabase.from("profiles").select("full_name, username").eq("id", user.id).single();
        await supabase.from("notifications").insert({
          user_id: post.author.id,
          type: "comment",
          sender_id: user.id,
          message: `${profile?.full_name || profile?.username || "Someone"} commented on your post!`,
        });
      }
    },
    [user, posts],
  );

  const getComments = useCallback(
    async (postId: string): Promise<CommentData[]> => {
      try {
        const { data, error } = await supabase
          .from("post_comments")
          .select(`id, content, created_at, user_id, author:profiles (id, username, full_name, avatar_url)`)
          .eq("post_id", postId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return (data as any[]).map((comment) => {
          const profile = Array.isArray(comment.author) ? comment.author[0] : comment.author;
          return {
            id: comment.id,
            content: comment.content,
            created_at: comment.created_at,
            author: {
              id: profile?.id || comment.user_id,
              name: profile?.full_name || "Anonymous User",
              handle: profile?.username || "unknown",
              avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username || "user"}`,
            },
          };
        });
      } catch (err) {
        console.error("Error fetching comments:", err);
        return [];
      }
    },
    [],
  );

  const sharePost = useCallback(
    async (postId: string) => {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        const url = `${window.location.origin}/community?shared=${postId}`;
        await navigator.clipboard.writeText(url);
      }
      await toggleRepost(postId);
    },
    [toggleRepost],
  );

  const deletePost = useCallback(
    async (postId: string) => {
      if (!user) return;
      try {
        const { error } = await supabase.from("posts").delete().eq("id", postId);
        if (error) throw error;
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } catch (err) {
        console.error("Error deleting post:", err);
      }
    },
    [user],
  );

  return (
    <PostContext.Provider
      value={{
        posts,
        addPost,
        editPost,
        toggleLike,
        toggleRepost,
        quoteRepost,
        addComment,
        getComments,
        sharePost,
        deletePost,
        refreshPosts: fetchPosts,
        loading,
        error,
      }}
    >
      {children}
    </PostContext.Provider>
  );
}

export const usePosts = () => {
  const context = useContext(PostContext);
  if (!context) throw new Error("usePosts must be used within a PostProvider");
  return context;
};
