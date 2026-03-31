// src/pages/Profile.tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Link as LinkIcon, ArrowLeft, MessageSquare } from 'lucide-react';
import { Post, type PostData } from '../components/feed/Post';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocial } from '../context/SocialContext';

const TABS = ['Posts', 'Replies', 'Media', 'Likes'];

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
  const [activeTab, setActiveTab] = useState('Posts');
  const [posts, setPosts] = useState<PostData[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followingLoading, setFollowingLoading] = useState(false);
  const { user: currentUser } = useAuth();
  const { followingIds, toggleFollow, followerCounts } = useSocial();

  const targetUserId = id || currentUser?.id;
  const isOwnProfile = !id || id === currentUser?.id;
  const isFollowing = targetUserId ? followingIds.includes(targetUserId) : false;

  useEffect(() => {
    const loadProfile = async () => {
      if (!targetUserId) return;
      setLoading(true);

      try {
        // Fetch Profile + Counts in one query
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetUserId)
          .maybeSingle();

        if (profileError) {
          console.warn('Profile select warning', profileError);
        }

        let activeProfile = profileData as any | null;

        // If it's my profile and it doesn't exist, create it
        if (!activeProfile && isOwnProfile && currentUser) {
          const defaultUsername = currentUser.email?.split('@')[0] || 'user';
          const { data: upsertData, error: upsertError } = await supabase
            .from('profiles')
            .upsert({
              id: currentUser.id,
              username: defaultUsername,
              full_name: defaultUsername,
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`,
              bio: '',
              website: ''
            })
            .select()
            .single();

          if (upsertError) throw upsertError;
          activeProfile = upsertData as any;
        }

        // Fallback for missing profile
        if (!activeProfile) {
          activeProfile = {
            id: targetUserId,
            username: `user_${targetUserId.substring(0, 5)}`,
            full_name: `User ${targetUserId.substring(0, 5)}`,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUserId}`,
            bio: 'No bio yet.',
            website: '',
            created_at: new Date().toISOString(),
            followers: [{ count: 0 }],
            following: [{ count: 0 }]
          };
        }

        setProfile(activeProfile as UserProfile);
        setFullName(activeProfile.full_name || '');
        setUsername(activeProfile.username || '');
        setBio(activeProfile.bio || '');
        setWebsite(activeProfile.website || '');
        setAvatarUrl(activeProfile.avatar_url || '');

        // Fetch Real Counts separately for accuracy
        const { count: fetchedFollowers } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_user_id', targetUserId);
        
        const { count: fetchedFollowing } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', targetUserId);

        setFollowerCount(fetchedFollowers || 0);
        setFollowingCount(fetchedFollowing || 0);

        // Fetch user posts
        const { data: postsData } = await supabase
          .from('posts')
          .select(`
            *,
            likes:post_likes!post_id(count),
            comments:post_comments!post_id(count),
            reposts:post_reposts!post_id(count)
          `)
          .eq('author_id', targetUserId)
          .order('created_at', { ascending: false });

        if (postsData) {
          const mappedPosts: PostData[] = (postsData as any[]).map((post: any) => ({
            id: post.id,
            author: {
              id: targetUserId,
              name: activeProfile?.full_name || activeProfile?.username || `User ${targetUserId.substring(0, 5)}`,
              handle: activeProfile?.username || `user_${targetUserId.substring(0, 5)}`,
              avatar: activeProfile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUserId}`
            },
            content: post.content,
            timestamp: new Date(post.created_at).toLocaleString(),
            likes: post.likes?.[0]?.count || 0,
            comments: post.comments?.[0]?.count || 0,
            reposts: post.reposts?.[0]?.count || 0,
            isLiked: false,
            isReposted: false,
          }));
          setPosts(mappedPosts);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [targetUserId, isOwnProfile, currentUser, followerCounts]);

  const handleUpdateProfile = async () => {
    if (!currentUser || !profile) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: currentUser.id,
          username: username || profile.username,
          full_name: fullName || profile.full_name,
          bio: bio || profile.bio,
          website: website || profile.website,
          avatar_url: avatarUrl || profile.avatar_url,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data as UserProfile);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
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

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="w-full pb-20 sm:pb-0"
    >
      <header className="sticky top-0 bg-dark/80 backdrop-blur-md border-b border-gray-800 p-2 z-40 flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold">{profile?.full_name}</h2>
            <p className="text-xs text-gray-500">{posts.length} Posts</p>
          </div>
      </header>

      {/* Banner Area */}
      <div className="relative h-32 sm:h-48 bg-gradient-to-r from-brand to-blue-900">
        <div className="absolute -bottom-16 left-4 w-32 h-32 bg-dark rounded-full border-4 border-dark overflow-hidden z-10">
          <img
            src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.id || 'user'}`}
            alt={profile?.full_name || 'User Avatar'}
            className="w-full h-full object-cover bg-gray-800"
          />
        </div>
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex justify-end mb-4">
          {isOwnProfile ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => isEditing ? handleUpdateProfile() : setIsEditing(true)}
              className="px-4 py-1.5 font-bold rounded-full border border-gray-500 hover:bg-gray-500/10 transition-colors"
              disabled={loading}
            >
              {isEditing ? (loading ? 'Saving...' : 'Save Profile') : 'Edit Profile'}
            </motion.button>
          ) : (
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/messages?user_id=${targetUserId}`)}
                className="p-2 border border-gray-500 rounded-full hover:bg-gray-800 transition-colors"
                title="Message"
              >
                <MessageSquare size={20} className="text-white" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleToggleFollow}
                disabled={followingLoading}
                className={`px-6 py-1.5 font-bold rounded-full transition-colors ${followingLoading ? 'opacity-50 cursor-not-allowed' : ''} ${isFollowing ? 'border border-gray-500 hover:bg-red-500/10 hover:border-red-500 hover:text-red-500 group' : 'bg-white text-dark hover:bg-gray-200'}`}
              >
                {followingLoading ? 'Processing...' : (isFollowing ? (
                  <>
                    <span className="group-hover:hidden">Following</span>
                    <span className="hidden group-hover:inline">Unfollow</span>
                  </>
                ) : 'Follow')}
              </motion.button>
            </div>
          )}
        </div>

        <div className="mt-16">
          {isEditing ? (
            <div className="space-y-3">
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name" className="w-full p-2 border border-gray-700 rounded bg-dark" />
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="w-full p-2 border border-gray-700 rounded bg-dark" />
              <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Bio" className="w-full p-2 border border-gray-700 rounded bg-dark" rows={3} />
              <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="Website URL" className="w-full p-2 border border-gray-700 rounded bg-dark" />
              <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="Avatar URL (Image Path)" className="w-full p-2 border border-gray-700 rounded bg-dark" />
              <div className="flex gap-2">
                <button onClick={() => setIsEditing(false)} className="px-4 py-1.5 rounded-full border border-gray-500 bg-transparent text-white font-bold">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white leading-tight">{profile?.full_name}</h1>
              <p className="text-gray-500">@{profile?.username}</p>
              
              <p className="mt-3 text-[15px] text-gray-200">{profile?.bio}</p>

              <div className="flex flex-wrap gap-4 mt-3 text-gray-500 text-sm">
                {profile?.website && (
                  <div className="flex items-center gap-1">
                    <LinkIcon size={16} />
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{profile.website.replace(/^https?:\/\//, '')}</a>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar size={16} />
                  <span>Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}</span>
                </div>
              </div>

              <div className="flex gap-4 mt-4 text-sm">
                <p><span className="text-white font-bold">{isOwnProfile ? followingIds.length : followingCount}</span> <span className="text-gray-500">Following</span></p>
                <p><span className="text-white font-bold">{targetUserId && followerCounts[targetUserId] !== undefined ? followerCounts[targetUserId] : followerCount}</span> <span className="text-gray-500">Followers</span></p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex border-b border-gray-800 mt-4 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className="flex-1 min-w-[80px] py-4 text-sm font-bold relative transition-colors hover:bg-white/5 uppercase">
            <span className={activeTab === tab ? 'text-white' : 'text-gray-500'}>{tab}</span>
            {activeTab === tab && <motion.div layoutId="profile-tab-indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-brand rounded-full mx-8" />}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'Posts' ? (
          <div>
            {posts.map((post, idx) => (
              <Post 
                key={post.id} post={post} index={idx} 
                onLike={() => {}} onComment={() => {}} onRepost={() => {}} onShare={() => {}} 
              />
            ))}
            {posts.length === 0 && !loading && (
              <div className="p-10 text-center text-gray-500">No posts shared yet.</div>
            )}
          </div>
        ) : (
          <div className="p-10 text-center text-gray-500 italic">Coming soon.</div>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-dark/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand"></div>
        </div>
      )}
    </motion.div>
  );
}