// src/pages/Profile.tsx
import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Link as LinkIcon,
  ArrowLeft,
  MessageSquare,
  Camera,
  X,
} from "lucide-react";
import { Post } from "../components/feed/Post";
import { type PostData } from "../context/PostContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../utils/supabase";
import { useParams, useNavigate } from "react-router-dom";
import { useSocial } from "../context/SocialContext";
import { usePosts } from "../context/PostContext";

const TABS = ["Posts", "Replies", "Media", "Likes"];

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  website: string;
  created_at: string;
}

export function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Posts");
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // State for image viewer
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // States for Follow Lists
  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followModalType, setFollowModalType] = useState<'followers' | 'following'>('followers');
  const [followList, setFollowList] = useState<any[]>([]);
  const [loadingFollows, setLoadingFollows] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followingLoading, setFollowingLoading] = useState(false);
  const { user: currentUser } = useAuth();
  const { followingIds, toggleFollow, followerCounts } = useSocial();
  const { toggleLike, toggleRepost, addComment } = usePosts();

  const targetUserId = id || currentUser?.id;
  const isOwnProfile = !id || id === currentUser?.id;
  const isFollowing = targetUserId
    ? followingIds.includes(targetUserId)
    : false;

  useEffect(() => {
    const loadProfile = async () => {
      if (!targetUserId) return;
      setLoading(true);

      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", targetUserId)
          .maybeSingle();

        if (profileError) {
          console.warn("Profile select warning", profileError);
        }

        let activeProfile = profileData as any | null;

        if (!activeProfile && isOwnProfile && currentUser) {
          const defaultUsername = currentUser.email?.split("@")[0] || "user";
          const { data: upsertData, error: upsertError } = await supabase
            .from("profiles")
            .upsert({
              id: currentUser.id,
              username: defaultUsername,
              full_name: defaultUsername,
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`,
              bio: "",
              website: "",
            })
            .select()
            .single();

          if (upsertError) throw upsertError;
          activeProfile = upsertData as any;
        }

        if (!activeProfile) {
          activeProfile = {
            id: targetUserId,
            username: `user_${targetUserId.substring(0, 5)}`,
            full_name: `User ${targetUserId.substring(0, 5)}`,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUserId}`,
            bio: "No bio yet.",
            website: "",
            created_at: new Date().toISOString(),
            followers: [{ count: 0 }],
            following: [{ count: 0 }],
          };
        }

        setProfile(activeProfile as UserProfile);
        setFullName(activeProfile.full_name || "");
        setUsername(activeProfile.username || "");
        setBio(activeProfile.bio || "");
        setWebsite(activeProfile.website || "");
        setAvatarUrl(activeProfile.avatar_url || "");

        const { count: fetchedFollowers } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_user_id", targetUserId);

        const { count: fetchedFollowing } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", targetUserId);

        setFollowerCount(fetchedFollowers || 0);
        setFollowingCount(fetchedFollowing || 0);

        const { data: postsData, error: _postsError } = await supabase
          .from("posts")
          .select(
            `
            *,
            author:profiles!author_id (*),
            likes:post_likes!post_id(count),
            comments:post_comments!post_id(count),
            reposts:post_reposts!post_id(count)
          `,
          )
          .eq("author_id", targetUserId)
          .order("created_at", { ascending: false });

        // Also fetch direct reposts (items in post_reposts table)
        const { data: directRepostsData } = await supabase
          .from("post_reposts")
          .select(`
            post:posts (
              *,
              author:profiles!author_id (*),
              likes:post_likes!post_id(count),
              comments:post_comments!post_id(count),
              reposts:post_reposts!post_id(count)
            )
          `)
          .eq("user_id", targetUserId);

        const allVisiblePosts = [...(postsData || [])];
        if (directRepostsData) {
           directRepostsData.forEach((item: any) => {
              if (item.post && !allVisiblePosts.find(p => p.id === item.post.id)) {
                 allVisiblePosts.push(item.post);
              }
           });
        }
        
        allVisiblePosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (allVisiblePosts.length > 0) {
          const likedResponse = currentUser
            ? await supabase.from('post_likes').select('post_id').eq('user_id', currentUser.id)
            : { data: [] };
          const repostedResponse = currentUser
            ? await supabase.from('post_reposts').select('post_id').eq('user_id', currentUser.id)
            : { data: [] };

          const likedIds = likedResponse.data?.map((item: any) => item.post_id) ?? [];
          const repostedIds = repostedResponse.data?.map((item: any) => item.post_id) ?? [];

          const mappedPosts: PostData[] = allVisiblePosts.map(
            (post: any) => {
               const authorProfile = post.author;
               return {
                  id: post.id,
                  author: {
                    id: post.author_id,
                    name: authorProfile?.full_name || 'User',
                    handle: authorProfile?.username || 'user',
                    avatar: authorProfile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author_id}`,
                  },
                  content: post.content,
                  timestamp: new Date(post.created_at).toLocaleString(),
                  likes: post.likes?.[0]?.count || 0,
                  comments: post.comments?.[0]?.count || 0,
                  reposts: post.reposts?.[0]?.count || 0,
                  isLiked: likedIds.includes(post.id),
                  isReposted: repostedIds.includes(post.id),
                  image: post.image,
                  location: post.location,
                  reposted_post_id: post.reposted_post_id,
                  original_post: post.original_post ? {
                    id: post.original_post.id,
                    author: {
                      id: post.original_post.author_id,
                      name: post.original_post.author?.full_name || 'User',
                      handle: post.original_post.author?.username || 'user',
                      avatar: post.original_post.author?.avatar_url || ''
                    },
                    content: post.original_post.content,
                    timestamp: new Date(post.original_post.created_at).toLocaleString(),
                   likes: post.original_post.likes?.[0]?.count || 0,
                   comments: post.original_post.comments?.[0]?.count || 0,
                   reposts: post.original_post.reposts?.[0]?.count || 0,
                   image: post.original_post.image
                  } : null
               };
            }
          );
          setPosts(mappedPosts);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [targetUserId, isOwnProfile, currentUser, followerCounts]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarUrl(URL.createObjectURL(file));
      setAvatarFile(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.id}`,
    );
    setAvatarFile(null);
  };

  const handleUpdateProfile = async () => {
    if (!currentUser || !profile) return;
    setLoading(true);

    try {
      let finalAvatarUrl = avatarUrl;

      // Upload image to Supabase Storage if a new file was selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;

        // Upload to 'avatars' bucket
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, avatarFile);

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw uploadError;
        }

        // Get the permanent public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(fileName);

        finalAvatarUrl = publicUrl;
      }

      // Save profile data with the permanent image URL
      const { data, error } = await supabase
        .from("profiles")
        .upsert({
          id: currentUser.id,
          username: username || profile.username,
          full_name: fullName || profile.full_name,
          bio: bio || profile.bio,
          website: website || profile.website,
          avatar_url: finalAvatarUrl,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data as UserProfile);
        setAvatarFile(null);
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Failed to update profile. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!targetUserId || followingLoading) return;

    setFollowingLoading(true);
    await toggleFollow(targetUserId, followerCount);
    setFollowingLoading(false);
  };

  const openFollowModal = async (type: 'followers' | 'following') => {
    if (!targetUserId) return;
    setFollowModalType(type);
    setFollowModalOpen(true);
    setLoadingFollows(true);
    setFollowList([]);

    try {
      // Query for followers or following
      const isFollowers = type === 'followers';
      const { data, error } = await supabase
        .from('follows')
        .select(`
          follower_id,
          following_user_id,
          user:profiles!${isFollowers ? 'follower_id' : 'following_user_id'} (
            id,
            username,
            full_name,
            avatar_url,
            bio
          )
        `)
        .eq(isFollowers ? 'following_user_id' : 'follower_id', targetUserId);

      if (error) throw error;
      
      if (data) {
        // Map the joined data to get the profiles
        const profiles = data
          .map((item: any) => item.user)
          .filter(u => u !== null); // Filter out any null joins
        setFollowList(profiles);
      }
    } catch (err) {
      console.error(`Error fetching ${type}:`, err);
    } finally {
      setLoadingFollows(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="w-full pb-20 sm:pb-0"
    >
      <header className="sticky top-0 bg-white/80 dark:bg-dark/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-2 z-40 flex items-center gap-6">
        <button
          onClick={() => navigate(-1)}
          // Fixed: Changed text color to text-black for light mode
          className="p-2 hover:bg-gray-800 rounded-full transition-colors text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          {/* Fixed: Changed text color to text-black for light mode */}
          <h2 className="text-xl font-bold text-white">{profile?.full_name}</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {posts.length} Posts
          </p>
        </div>
      </header>

      {/* Banner Area */}
      <div className="relative h-32 sm:h-48 bg-gradient-to-r from-brand to-blue-900">
        {/* AVATAR WRAPPER */}
        <div 
          onClick={() => !isEditing && setShowAvatarModal(true)}
          className={`absolute -bottom-16 left-4 w-32 h-32 bg-white dark:bg-dark rounded-full border-4 border-white dark:border-dark overflow-hidden z-20 group shadow-lg ${!isEditing ? 'cursor-zoom-in hover:scale-[1.02] transition-transform' : ''}`}
        >
          <img
            src={
              isEditing
                ? avatarUrl
                : profile?.avatar_url ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.id || "user"}`
            }
            alt={profile?.full_name || "User Avatar"}
            className="w-full h-full object-cover bg-gray-100 dark:bg-gray-800"
          />

          {/* EDIT MODE AVATAR OVERLAY */}
          <AnimatePresence>
            {isEditing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white/20 dark:bg-black/30 hover:bg-white/40 dark:hover:bg-black/50 transition-colors flex items-center justify-center gap-2"
              >
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 bg-white/90 dark:bg-black/60 backdrop-blur-md border border-gray-200 dark:border-white/20 text-gray-800 dark:text-white hover:text-white hover:border-brand dark:hover:bg-green-500 rounded-full transition-colors shadow-lg"
                  title="Upload new photo"
                >
                  <Camera size={18} />
                </button>

                <button
                  onClick={handleRemoveAvatar}
                  className="p-2 bg-white/90 dark:bg-black/60 backdrop-blur-md border border-gray-200 dark:border-white/20 text-gray-800 dark:text-white hover:bg-red-500 hover:text-white hover:border-red-500 dark:hover:bg-red-500 rounded-full transition-colors shadow-lg"
                  title="Remove photo"
                >
                  <X size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex justify-end mb-4 relative z-10">
          {isOwnProfile ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() =>
                isEditing ? handleUpdateProfile() : setIsEditing(true)
              }
              className="px-4 py-1.5 font-bold rounded-full border border-gray-300 dark:border-gray-500 bg-white dark:bg-transparent  dark:hover:bg-white/10 transition-colors text-black dark:text-white"
              disabled={loading}
            >
              {isEditing
                ? loading
                  ? "Saving..."
                  : "Save Profile"
                : "Edit Profile"}
            </motion.button>
          ) : (
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/messages?user_id=${targetUserId}`)}
                className="p-2 border border-gray-300 dark:border-gray-500 rounded-full bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                title="Message"
              >
                <MessageSquare
                  size={20}
                  className="text-black dark:text-white"
                />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleToggleFollow}
                disabled={followingLoading}
                className={`px-6 py-1.5 font-bold rounded-full transition-colors ${followingLoading ? "opacity-50 cursor-not-allowed" : ""} ${isFollowing ? "border border-gray-300 dark:border-gray-500 hover:bg-red-50 hover:border-red-500 hover:text-red-500 dark:hover:bg-red-500/10 group" : "bg-dark text-white dark:bg-white dark:text-dark hover:opacity-90"}`}
              >
                {followingLoading ? (
                  "Processing..."
                ) : isFollowing ? (
                  <>
                    <span className="group-hover:hidden">Following</span>
                    <span className="hidden group-hover:inline">Unfollow</span>
                  </>
                ) : (
                  "Follow"
                )}
              </motion.button>
            </div>
          )}
        </div>

        <div className="mt-16">
          {isEditing ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-xs text-gray-600 dark:text-gray-500 font-bold uppercase ml-1">
                  Name
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-transparent text-black dark:text-gray-500 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all placeholder-gray-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-600 dark:text-gray-500 font-bold uppercase ml-1">
                  Username
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-transparent text-black dark:text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all placeholder-gray-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-600 dark:text-gray-500 font-bold uppercase ml-1">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Bio"
                  className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-transparent text-black dark:text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all resize-none placeholder-gray-400"
                  rows={3}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-600 dark:text-gray-500 font-bold uppercase ml-1">
                  Website
                </label>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="Website URL"
                  className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-transparent text-black dark:text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all placeholder-gray-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-2 rounded-full border border-gray-300 dark:border-gray-500 bg-white dark:bg-transparent text-black dark:text-white font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white leading-tight">
                {profile?.full_name}
              </h1>
              <p className="text-gray-500">@{profile?.username}</p>

              <p className="mt-3 text-[15px] text-gray-200">{profile?.bio}</p>

              <div className="flex flex-wrap gap-4 mt-3 text-gray-600 dark:text-gray-400 text-sm">
                {profile?.website && (
                  <div className="flex items-center gap-1">
                    <LinkIcon size={16} />
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline"
                    >
                      {profile.website.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar size={16} />
                  <span>
                    Joined{" "}
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString(
                          "en-US",
                          { month: "long", year: "numeric" },
                        )
                      : "Recently"}
                  </span>
                </div>
              </div>

              <div className="flex gap-4 mt-4 text-sm">
                <button 
                  onClick={() => openFollowModal('following')}
                  className="hover:underline transition-all flex gap-1 items-center group"
                >
                  <span className="text-black dark:text-white font-bold group-hover:text-brand">
                    {isOwnProfile ? followingIds.length : followingCount}
                  </span>{" "}
                  <span className="text-gray-600 dark:text-gray-400">
                    Following
                  </span>
                </button>
                <button 
                  onClick={() => openFollowModal('followers')}
                  className="hover:underline transition-all flex gap-1 items-center group"
                >
                  <span className="text-black dark:text-white font-bold group-hover:text-brand">
                    {targetUserId && followerCounts[targetUserId] !== undefined
                      ? followerCounts[targetUserId]
                      : followerCount}
                  </span>{" "}
                  <span className="text-gray-600 dark:text-gray-400">
                    Followers
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-800 mt-4 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 min-w-[80px] py-4 text-sm font-bold relative transition-colors hover:bg-black/5 dark:hover:bg-white/5 uppercase"
          >
            <span
              className={
                activeTab === tab
                  ? "text-black dark:text-white font-bold"
                  : "text-gray-500 dark:text-gray-400 font-medium"
              }
            >
              {tab}
            </span>
            {activeTab === tab && (
              <motion.div
                layoutId="profile-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-1 bg-brand rounded-full mx-8"
              />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === "Posts" ? (
          <div>
            {posts.map((post, idx) => (
              <Post
                key={post.id}
                post={post}
                index={idx}
                onLike={() => toggleLike(post.id)}
                onComment={(content) => addComment(post.id, content)}
                onRepost={() => toggleRepost(post.id)}
                activeDropdownId={activeDropdownId} 
                setActiveDropdownId={setActiveDropdownId}
              />
            ))}
            {posts.length === 0 && !loading && (
              <div className="p-10 text-center text-gray-500">
                No posts shared yet.
              </div>
            )}
          </div>
        ) : (
          <div className="p-10 text-center text-gray-500 italic">
            Coming soon.
          </div>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-white/50 dark:bg-dark/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand"></div>
        </div>
      )}

      {/* Profile Image Viewer Modal */}
      <AnimatePresence>
        {showAvatarModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAvatarModal(false)}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors border border-white/10"
              onClick={() => setShowAvatarModal(false)}
            >
              <X size={24} />
            </motion.button>
            
            <motion.img
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.id || "user"}`}
              alt={profile?.full_name}
              className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Follows List Modal */}
      <AnimatePresence>
        {followModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFollowModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-gray-200 dark:border-gray-800"
            >
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-black dark:text-white capitalize">
                  {followModalType}
                </h3>
                <button 
                  onClick={() => setFollowModalOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {loadingFollows ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 text-sm">Loading list...</p>
                  </div>
                ) : followList.length > 0 ? (
                  <div className="space-y-1">
                    {followList.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setFollowModalOpen(false);
                          navigate(`/profile/${user.id}`);
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-2xl transition-all group"
                      >
                        <img 
                          src={user.avatar_url} 
                          className="w-12 h-12 rounded-full object-cover border border-gray-100 dark:border-gray-800 group-hover:scale-105 transition-transform" 
                          alt={user.full_name} 
                        />
                        <div className="flex-1 text-left">
                          <p className="font-bold text-black dark:text-white group-hover:text-brand transition-colors">
                            {user.full_name}
                          </p>
                          <p className="text-gray-500 text-sm">@{user.username}</p>
                        </div>
                        <div className="px-4 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          View Profile
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                      <Calendar className="text-gray-400" />
                    </div>
                    <p className="text-black dark:text-white font-bold">No {followModalType} yet</p>
                    <p className="text-gray-500 text-sm mt-1">
                      When people {followModalType === 'followers' ? 'follow this account' : 'are followed by this account'}, they'll show up here.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
