import { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  UserPlus, 
  MessageSquare, 
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

// Standard icons based on type
const getTypeIcon = (type: string) => {
  switch (type) {
    case 'follow': return <UserPlus className="w-5 h-5 text-blue-500" />;
    case 'like': return <Heart className="w-5 h-5 text-pink-500 fill-pink-500/20" />;
    case 'comment': return <MessageSquare className="w-5 h-5 text-green-500" />;
    default: return <Bell className="w-5 h-5 text-gray-500" />;
  }
};

interface SupabaseNotification {
  id: string;
  type: string;
  message: string;
  created_at: string;
  is_read: boolean;
  senderid: string;
  sender: {
    full_name: string;
    username: string;
    avatar_url: string;
  };
}

export default function Notifications() {
  const { user } = useAuth();
  const { initialData } = useData();
  const [notifications, setNotifications] = useState<SupabaseNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = async () => {
    if (!user) return;

    if (initialData?.notifications) {
      setNotifications(initialData.notifications);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:profiles!senderid (
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user, initialData]);

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => !n.is_read);

  return (
    <div className="min-h-screen py-6 sm:px-4 lg:px-6 w-full">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between px-4 mb-4">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <span className="bg-brand text-white text-[10px] px-2 py-1 rounded-full">{unreadCount}</span>
            )}
          </h1>
          
          <button onClick={markAllAsRead} className="p-2 text-gray-500 hover:text-brand hover:bg-brand/10 rounded-full transition-colors">
            <CheckCheck className="w-5 h-5" />
          </button>
        </div>

        <div className="flex px-4 border-gray-800 mb-6 gap-6">
          <button onClick={() => setFilter('all')} className={`pb-3 relative text-sm font-medium transition-colors ${filter === 'all' ? 'text-brand' : 'text-gray-500'}`}>
            All
            {filter === 'all' && <motion.div layoutId="activeTab" className="absolute -bottom-[1px] left-0 right-0 h-[4px] bg-brand rounded-full" />}
          </button>
          <button onClick={() => setFilter('unread')} className={`pb-3 relative text-sm font-medium transition-colors ${filter === 'unread' ? 'text-brand' : 'text-gray-500'}`}>
            Unread
            {filter === 'unread' && <motion.div layoutId="activeTab" className="absolute -bottom-[1px] left-0 right-0 h-[4px] bg-brand rounded-full" />}
          </button>
        </div>

        <div className="w-full md:rounded-2xl border border-gray-800 overflow-hidden bg-gray-900/40">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-gray-800/50 p-6 rounded-full mb-4">
                <Bell className="w-10 h-10 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-white">No notifications</h3>
              <p className="text-gray-500 mt-1 text-sm">You're all caught up!</p>
            </div>
          ) : (
            <div className="flex flex-col">
              <AnimatePresence mode='popLayout'>
                {filteredNotifications.map((notification) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={notification.id}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                    className={`group relative flex items-start gap-4 p-4 cursor-pointer transition-colors border-b border-gray-800 last:border-b-0 hover:bg-gray-800/50 ${!notification.is_read ? 'bg-brand/5' : ''}`}
                  >
                    {!notification.is_read && <div className="absolute top-1/2 left-1.5 -translate-y-1/2 w-1.5 h-1.5 bg-brand rounded-full" />}

                    <div className="flex-shrink-0 relative">
                      <img 
                        src={notification.sender?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${notification.senderid}`} 
                        className="w-10 h-10 rounded-full border border-gray-700" 
                      />
                      <div className="absolute -bottom-1 -right-1 bg-dark rounded-full p-1 border border-gray-800">
                        {getTypeIcon(notification.type)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h4 className={`text-sm font-bold truncate ${!notification.is_read ? 'text-white' : 'text-gray-300'}`}>
                          {notification.sender?.full_name || 'Someone'}
                        </h4>
                        <span className="text-xs text-gray-500">{new Date(notification.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">{notification.message}</p>
                    </div>

                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
