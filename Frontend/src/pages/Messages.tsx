import { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Edit, 
  MessageSquareOff, 
  CheckCheck,
  Plus
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

  const activeSearch = searchQuery || localSearch;

  // Sync Conversations from Backend
  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:10000/api/conversations', {
          headers: { 'x-user-id': user.id }
        });
        if (!response.ok) throw new Error('Failed to fetch');
        
        const data = await response.json();
        
        // Enrich conversations with profile data from Supabase
        const enrichedChats = await Promise.all(data.map(async (convo: any) => {
          const targetId = convo.participants.find((p: string) => p !== user.id);
          const { data: profile } = await supabase.from('profiles').select('full_name, username, avatar_url').eq('id', targetId).single();
          
          return {
            id: convo.id,
            sender: profile?.full_name || profile?.username || 'User',
            avatarColor: 'bg-brand',
            initials: (profile?.full_name || 'U').substring(0, 1).toUpperCase(),
            lastMessage: convo.lastMessage || 'No messages yet',
            timestamp: new Date(convo.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            unreadCount: 0,
            isOnline: true,
            targetUserId: targetId
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

    if (user && targetUserId) {
      const openChatWithUser = async () => {
        try {
          const response = await fetch('http://localhost:10000/api/conversations', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-user-id': user.id 
            },
            body: JSON.stringify({ targetUserId })
          });

          if (response.ok) {
            const data = await response.json();
            
            // Check if we already have this chat in the state to avoid duplicates
            if (!chats.find(c => c.id === data.id)) {
              const { data: profile } = await supabase.from('profiles').select('full_name, username, avatar_url').eq('id', targetUserId).single();
              
              const newChat: Chat = {
                id: data.id,
                sender: profile?.full_name || profile?.username || 'User',
                avatarColor: 'bg-brand',
                initials: (profile?.full_name || 'U').substring(0, 1).toUpperCase(),
                lastMessage: data.lastMessage || 'New conversation',
                timestamp: 'Now',
                unreadCount: 0,
                isOnline: true,
                targetUserId: targetUserId
              };
              setChats(prev => [newChat, ...prev]);
            }
            
            setSelectedChatId(data.id);
          }
        } catch (err) {
          console.error('Error starting conversation:', err);
        }
      };

      openChatWithUser();
    }
  }, [location.search, user, chats.length]);

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
              className="p-2 text-brand transition-colors"
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

      {/* FAB for Mobile */}
      <motion.button 
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-24 right-6 p-4 bg-brand text-brand-contrast rounded-full shadow-lg shadow-brand/40 md:hidden z-10"
      >
        <Plus size={24} />
      </motion.button>
    </div>
  );
}