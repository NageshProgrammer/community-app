import { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Edit, 
  MessageSquareOff, 
  CheckCheck,
  Plus,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import Conversation from '../components/shared/Conversation';
import { useSocial } from '../context/SocialContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';

type Chat = {
  id: string;
  sender: string;
  avatarColor: string;
  initials: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isOnline: boolean;
  targetUserId?: string; // Real user ID for Supabase DMs
  isGroup?: boolean;
};

export default function Messages() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [localSearch, setLocalSearch] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const { searchQuery } = useSocial();
  const [loading, setLoading] = useState(true);

  // New Group States
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [followerSearch, setFollowerSearch] = useState('');
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const activeSearch = searchQuery || localSearch;

  // Sync Conversations from Backend
  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      setLoading(true);
      try {
        const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:10000').replace(/\/$/, '');
        const response = await fetch(`${BACKEND_URL}/api/conversations`, {
          headers: { 'x-user-id': user.id }
        });
        if (!response.ok) throw new Error('Failed to fetch');
        
        const data = await response.json();
        
      // Enrich conversations with profile data from Supabase
      const enrichedChats = await Promise.all(data.map(async (convo: any) => {
        const isGroup = convo.participants.length > 2 || convo.isGroup; // Fallback to isGroup flag if exists
        const targetId = convo.participants.find((p: string) => p !== user.id);
        const { data: profile } = await supabase.from('profiles').select('full_name, username').eq('id', targetId).single();
        
        return {
          id: convo.id,
          sender: isGroup ? (convo.name || "Group") : (profile?.full_name || profile?.username || 'User'),
          avatarColor: 'bg-brand',
          initials: (isGroup ? (convo.name || "G") : (profile?.full_name || 'U')).substring(0, 1).toUpperCase(),
          lastMessage: convo.lastMessage || 'No messages yet',
          timestamp: new Date(convo.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unreadCount: 0,
          isOnline: true,
          targetUserId: targetId,
          isGroup: isGroup
        };
      }));

        setChats(enrichedChats);
      } catch (err) {
        console.error('Error fetching conversations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [user]);

  // Handle opening a chat from a URL param (?user_id=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetUserId = params.get('user_id');

    // Only fetch if we have a target user AND we aren't already looking at that chat
    if (user && targetUserId && selectedChatId === null) {
      const openChatWithUser = async () => {
        try {
          const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:10000').replace(/\/$/, '');
          const response = await fetch(`${BACKEND_URL}/api/conversations/with/${targetUserId}`, {
            method: 'GET',
            headers: { 'x-user-id': user.id }
          });
          
          let data;
          if (response.status === 404) {
             const createRes = await fetch(`${BACKEND_URL}/api/conversations`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
               body: JSON.stringify({ targetUserId })
             });
             data = await createRes.json();
          } else {
             data = await response.json();
          }

          if (data?.id) {
            setSelectedChatId(data.id);
            
            // Add to chats list if not already there
            if (!chats.find(c => c.id === data.id)) {
              const otherParticipantId = data.participants.find((p: string) => p !== user.id);
              if (otherParticipantId) {
                const { data: profile } = await supabase.from('profiles').select('full_name, username, avatar_url').eq('id', otherParticipantId).single();
                const newChat = {
                  id: data.id,
                  sender: profile?.full_name || 'User',
                  avatarColor: 'bg-brand',
                  initials: (profile?.full_name || 'U')[0].toUpperCase(),
                  lastMessage: 'New conversation',
                  timestamp: 'Now',
                  unreadCount: 0,
                  isOnline: true,
                  targetUserId: otherParticipantId
                };
                setChats(prev => [newChat, ...prev]);
              }
            }
          }
        } catch (err) {
          console.error('Error starting conversation:', err);
        }
      };

      openChatWithUser();
    }
  }, [location.search, user, selectedChatId]); 

  // Fetch Following for Group Creation
  useEffect(() => {
    if (showNewGroupModal && user) {
      const fetchFollowing = async () => {
        setLoadingFollowers(true);
        try {
          const { data, error } = await supabase
            .from('follows')
            .select(`
              following_user_id,
              user:profiles!following_user_id (
                id,
                username,
                full_name,
                avatar_url
              )
            `)
            .eq('follower_id', user.id);

          if (error) throw error;
          const profiles = data.map(d => d.user).filter(p => p !== null);
          setFollowingList(profiles);
        } catch (err) {
          console.error('Error fetching followers for group:', err);
        } finally {
          setLoadingFollowers(false);
        }
      };
      fetchFollowing();
    }
  }, [showNewGroupModal, user]);

  const handleCreateGroup = async () => {
    if (!user || selectedUsers.length === 0) return;
    
    setCreatingGroup(true);
    try {
      const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:10000').replace(/\/$/, '');
      const response = await fetch(`${BACKEND_URL}/api/conversations`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user.id 
        },
        body: JSON.stringify({ 
          participants: selectedUsers,
          name: groupName || 'New Group'
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add to local state
        const newChat: Chat = {
          id: data.id,
          sender: data.name || 'New Group',
          avatarColor: 'bg-brand',
          initials: (data.name || 'G').substring(0, 1).toUpperCase(),
          lastMessage: 'Group created',
          timestamp: 'Now',
          unreadCount: 0,
          isOnline: true,
          isGroup: true
        };
        
        setChats(prev => [newChat, ...prev]);
        setSelectedChatId(data.id);
        setShowNewGroupModal(false);
        setGroupName('');
        setSelectedUsers([]);
      }
    } catch (err) {
      console.error('Error creating group:', err);
      alert('Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const filteredFollowers = useMemo(() => {
    return followingList.filter(u => 
      u.full_name.toLowerCase().includes(followerSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(followerSearch.toLowerCase())
    );
  }, [followingList, followerSearch]);

  // Derived state
  const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  const filteredChats = useMemo(() => {
    return chats.filter(chat => {
      const matchesTab = filter === 'all' || chat.unreadCount > 0;
      const matchesSearch = chat.sender.toLowerCase().includes(activeSearch.toLowerCase()) || 
                            chat.lastMessage.toLowerCase().includes(activeSearch.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [chats, filter, activeSearch]);

  const selectedChat = useMemo(() => 
    chats.find(c => c.id === selectedChatId), 
    [chats, selectedChatId]
  );

  const markAllAsRead = () => {
    setChats(prev => prev.map(chat => ({ ...chat, unreadCount: 0 })));
  };

  if (selectedChatId && selectedChat) {
    return (
      <div className="p-4 w-full max-w-3xl mx-auto h-screen">
        <Conversation 
          chat={selectedChat} 
          onBack={() => {
            setSelectedChatId(null);
            navigate('/messages', { replace: true });
          }} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 sm:px-4 lg:px-6 w-full transition-colors duration-300">
      <div className="max-w-3xl mx-auto">
        
        {/* Header Section */}
        <div className="flex items-center justify-between px-4 mb-4">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2">
            Messages
            {totalUnread > 0 && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="bg-brand text-brand-contrast font-bold text-[10px] px-2 py-1 rounded-full leading-none"
              >
                {totalUnread}
              </motion.span>
            )}
          </h1>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={markAllAsRead}
              className="p-2 text-gray-400 hover:text-brand transition-colors"
              title="Mark all as read"
            >
              <CheckCheck className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowNewGroupModal(true)}
              className="p-2 text-brand hover:bg-brand/10 rounded-full transition-colors"
              title="New Message"
            >
              <Edit className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar - Fixed class for Glass effect */}
        <div className="px-4 mb-6">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-500 group-focus-within:text-brand transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-800 rounded-xl leading-5 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all sm:text-sm"
              placeholder="Search messages..."
              value={activeSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex px-4 border-gray-800 mb-6 gap-6 relative border-b">
          <button
            onClick={() => setFilter('all')}
            className={`pb-3 relative text-sm font-medium transition-colors ${
              filter === 'all' ? 'text-brand' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            All
            {filter === 'all' && (
              <motion.div 
                layoutId="messageTab" 
                className="absolute -bottom-[1px] left-0 right-0 h-[4px] bg-brand rounded-full" 
              />
            )}
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`pb-3 relative text-sm font-medium transition-colors ${
              filter === 'unread' ? 'text-brand' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Unread
            {filter === 'unread' && (
              <motion.div 
                layoutId="messageTab" 
                className="absolute -bottom-[1px] left-0 right-0 h-[4px] bg-brand rounded-full" 
              />
            )}
          </button>
        </div>

        {/* Messages List Container - Applied Glass effect */}
        <div className="w-full md:rounded-2xl border border-gray-800 overflow-hidden bg-gray-900 min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
            </div>
          ) : filteredChats.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center bg-transparent"
            >
              <div className="bg-gray-800 p-6 rounded-full mb-4">
                <MessageSquareOff className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-white">No messages found</h3>
              <p className="text-gray-500 mt-1 text-sm">
                {activeSearch ? "Try searching for something else." : "You have no open conversations."}
              </p>
              {activeSearch && (
                <button 
                  onClick={() => {setLocalSearch(''); setSelectedChatId(null)}}
                  className="mt-6 px-6 py-2 bg-brand text-brand-contrast rounded-full font-bold hover:opacity-90 transition-all"
                >
                  Clear search
                </button>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col">
              <AnimatePresence mode='popLayout'>
                {filteredChats.map((chat) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    key={chat.id}
                    className="group relative flex items-center gap-4 p-4 cursor-pointer transition-colors border-b border-gray-800 last:border-b-0 hover:bg-gray-800"
                    onClick={() => {
                      setSelectedChatId(chat.id);
                      if (chat.unreadCount > 0) {
                        setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } : c));
                      }
                    }}
                  >
                    {/* Avatar with Online Status */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-brand-contrast font-bold text-lg ${chat.avatarColor}`}>
                        {chat.initials}
                      </div>
                      {chat.isOnline && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-transparent rounded-full"></div>
                      )}
                    </div>

                    {/* Chat Content */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h4 className={`text-base truncate ${
                          chat.unreadCount > 0 ? 'font-bold text-white' : 'font-medium text-white'
                        }`}>
                          {chat.sender}
                        </h4>
                        <span className={`text-xs flex-shrink-0 ${
                          chat.unreadCount > 0 ? 'text-brand font-medium' : 'text-gray-500'
                        }`}>
                          {chat.timestamp}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <p className={`text-sm truncate leading-snug ${
                          chat.unreadCount > 0 ? 'text-gray-300 font-medium' : 'text-gray-500'
                        }`}>
                          {chat.lastMessage}
                        </p>
                        
                        {/* Unread Badge */}
                        {chat.unreadCount > 0 && (
                          <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-brand rounded-full text-brand-contrast text-[10px] font-bold">
                            {chat.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* New Group Modal */}
      <AnimatePresence>
        {showNewGroupModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewGroupModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-gray-800"
            >
              <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
                <h3 className="text-xl font-bold text-black dark:text-white">
                  Create New Group
                </h3>
                <button 
                  onClick={() => setShowNewGroupModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Group Name Input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-400 ml-1">Group Name</label>
                  <input 
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Enter group name..."
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-2xl text-black dark:text-white focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all"
                  />
                </div>

                {/* Search Followers */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-400 ml-1">Select Participants ({selectedUsers.length})</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                      type="text"
                      value={followerSearch}
                      onChange={(e) => setFollowerSearch(e.target.value)}
                      placeholder="Search followers..."
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-2xl text-black dark:text-white focus:ring-1 focus:ring-brand focus:border-transparent outline-none transition-all text-sm"
                    />
                  </div>
                </div>

                {/* Followers List */}
                <div className="space-y-1">
                  {loadingFollowers ? (
                    <div className="py-10 flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : filteredFollowers.length > 0 ? (
                    filteredFollowers.map((profile) => (
                      <div 
                        key={profile.id}
                        onClick={() => toggleUserSelection(profile.id)}
                        className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
                          selectedUsers.includes(profile.id) 
                            ? 'bg-brand/10 border-brand/30' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent'
                        }`}
                      >
                        <img 
                          src={profile.avatar_url} 
                          className="w-10 h-10 rounded-full object-cover" 
                          alt={profile.full_name} 
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-black dark:text-white truncate">{profile.full_name}</p>
                          <p className="text-gray-500 text-xs text-brand">@{profile.username}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedUsers.includes(profile.id) 
                            ? 'bg-brand border-brand' 
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {selectedUsers.includes(profile.id) && <CheckCheck className="w-3 h-3 text-brand-contrast" />}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-10 text-gray-500 text-sm italic">
                      {followerSearch ? "No users found" : "You aren't following anyone yet."}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                <button
                  disabled={selectedUsers.length === 0 || creatingGroup}
                  onClick={handleCreateGroup}
                  className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                    selectedUsers.length > 0 && !creatingGroup
                      ? 'bg-brand text-brand-contrast shadow-lg shadow-brand/30 hover:opacity-95'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  }`}
                >
                  {creatingGroup ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Create Group Conversation
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}