// src/components/layout/Sidebar.tsx
import { useState, useEffect, useRef } from 'react';
import { Home, Bell, MessageSquare, User, MoreHorizontal, Bookmark, Settings, HelpCircle, Sun, Moon, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Bell, label: 'Notifications', path: '/notifications' },
  { icon: MessageSquare, label: 'Messages', path: '/messages' },
  { icon: User, label: 'Profile', path: '/profile' },
];

const moreItems = [
  { icon: Bookmark, label: 'Bookmarks', path: '/bookmarks' },
  { icon: Settings, label: 'Settings and privacy', path: '/settings' },
  { icon: HelpCircle, label: 'Help center', path: '/help' },
];

interface SidebarProps {
  onOpenPostModal: () => void;
}

export function Sidebar({ onOpenPostModal }: SidebarProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  // State for dynamic badge counts
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const lastFetchTime = useRef(0);

  // Fetch initial counts when sidebar loads
  useEffect(() => {
    if (!user) return;

    const fetchBadgeCounts = async () => {
      // Throttle: Don't fetch if we've fetched in the last 15 seconds
      const now = Date.now();
      if (now - lastFetchTime.current < 15000) return;
      lastFetchTime.current = now;

      try {
        const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:10000').replace(/\/$/, '');
        
        // Use parallel fetching to reduce connection time
        const [convRes, notifRes] = await Promise.all([
           fetch(`${BACKEND_URL}/api/conversations`, { headers: { 'x-user-id': user.id } }),
           fetch(`${BACKEND_URL}/api/notifications`, { headers: { 'x-user-id': user.id } })
        ]);
        
        if (convRes.ok) {
          const conversations = await convRes.json();
          const totalUnreadMsgs = conversations.reduce((sum: number, chat: any) => sum + (chat.unreadCount || 0), 0);
          setUnreadMessages(totalUnreadMsgs);
        }

        if (notifRes.ok) {
          const notifications = await notifRes.json();
          const totalUnreadNotifs = notifications.filter((n: any) => !n.isRead).length;
          setUnreadNotifications(totalUnreadNotifs);
        }
      } catch (err) {
        console.error('Failed to fetch sidebar badge counts:', err);
      }
    };

    fetchBadgeCounts();

    // DISABLED POLLING COMPLETELY TO SAVE FREE TIER LIMITS
    // const interval = setInterval(fetchBadgeCounts, 300000); 
    // return () => clearInterval(interval);

  }, [user?.id]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="hidden sm:flex flex-col w-20 xl:w-64 h-screen sticky top-0 border-r-4 border-gray-800 p-4 z-20 bg-dark">

      {/* Logo Area */}
      <div className="flex items-center justify-center xl:justify-start mb-8 p-3">
        <motion.div
          whileHover={{ rotate: 180 }}
          className="w-10 h-10 bg-brand rounded-full flex-shrink-0 shadow-lg shadow-brand/20"
        />
        <span className="hidden xl:block ml-4 text-xl font-bold">Community</span>
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center p-3 rounded-full transition-colors w-max xl:w-full ${isActive ? 'font-bold' : 'hover:bg-gray-800'
              }`
            }
          >
            {({ isActive }) => (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex items-center w-full relative">
                <div className="relative">
                  <item.icon size={28} className={isActive ? 'text-white' : 'text-gray-500'} fill={isActive ? 'currentColor' : 'none'} />
                  
                  {/* Dynamic Notifications Badge */}
                  {item.label === 'Notifications' && unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 bg-brand text-brand-contrast font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-dark shadow-sm">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                  
                  {/* Dynamic Messages Badge */}
                  {item.label === 'Messages' && unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 bg-brand text-brand-contrast font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-dark shadow-sm">
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                  )}

                </div>
                <span className="hidden xl:block ml-4 text-xl text-white">{item.label}</span>
              </motion.div>
            )}
          </NavLink>
        ))}

        <div className="relative">
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className="flex items-center p-3 rounded-full transition-colors w-max xl:w-full hover:bg-gray-800"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex items-center w-full">
              <MoreHorizontal size={28} className="text-gray-500" />
              <span className="hidden xl:block ml-4 text-xl">More</span>
            </motion.div>
          </button>

          <AnimatePresence>
            {isMoreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMoreOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col backdrop-blur-xl"
                >
                  <button
                    onClick={() => {
                      toggleTheme();
                      setIsMoreOpen(false);
                    }}
                    className="flex items-center gap-4 p-4 hover:bg-gray-800 transition-colors w-full text-left border-b border-gray-800"
                  >
                    {theme === 'dark' ? <Sun size={20} className="text-gray-300" /> : <Moon size={20} className="text-gray-300" />}
                    <span className="font-bold text-lg">Switch to {theme === 'dark' ? 'Light' : 'Dark'}</span>
                  </button>
                  {moreItems.map((item) => (
                    <NavLink
                      key={item.label}
                      to={item.path}
                      onClick={() => setIsMoreOpen(false)}
                      className="flex items-center gap-4 p-4 hover:bg-gray-800 transition-colors w-full text-left"
                    >
                      <item.icon size={20} className="text-gray-300" />
                      <span className="font-bold text-lg">{item.label}</span>
                    </NavLink>
                  ))}
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMoreOpen(false);
                    }}
                    className="flex items-center gap-4 p-4 hover:bg-gray-800 transition-colors w-full text-left border-t border-gray-800"
                  >
                    <LogOut size={20} className="text-gray-300" />
                    <span className="font-bold text-lg">Logout</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </nav>

      <motion.button
        onClick={onOpenPostModal}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="mt-auto bg-brand text-brand-contrast font-bold py-3 px-4 rounded-full hidden xl:block shadow-lg shadow-brand/20 cursor-pointer"
      >
        Post
      </motion.button>
    </div>
  );
}