// src/components/layout/MobileDrawer.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { User, Bookmark, Settings, HelpCircle, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { icon: User, label: 'Profile', path: '/profile' },
  { icon: Bookmark, label: 'Bookmarks', path: '/bookmarks' },
  { icon: Settings, label: 'Settings and privacy', path: '/settings' },
  { icon: HelpCircle, label: 'Help center', path: '/help' },
];

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Darkened Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50 sm:hidden backdrop-blur-sm"
          />

          {/* Sliding Drawer Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className="fixed top-0 left-0 bottom-0 w-[280px] bg-dark border-r border-gray-800 z-50 p-4 sm:hidden flex flex-col overflow-y-auto"
          >
            {/* Header / Avatar */}
            <div className="flex justify-between items-start mb-4">
              <img 
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Narayan" 
                alt="Avatar" 
                className="w-12 h-12 rounded-full bg-gray-800"
              />
              <button 
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* User Info */}
            <div className="mb-6">
              <h2 className="text-xl font-bold">Narayan M.</h2>
              <p className="text-gray-500">@narayan_dev</p>
              <div className="flex gap-4 mt-3 text-sm">
                <div className="hover:underline cursor-pointer"><span className="font-bold text-white">120</span> <span className="text-gray-500">Following</span></div>
                <div className="hover:underline cursor-pointer"><span className="font-bold text-white">1.5K</span> <span className="text-gray-500">Followers</span></div>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-2 mt-2 border-t border-gray-800 pt-4">
              {menuItems.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.path}
                  onClick={onClose} // Close drawer when a link is clicked
                  className={({ isActive }) => 
                    `flex items-center gap-4 p-3 rounded-xl transition-colors text-lg font-medium ${
                      isActive ? 'bg-gray-900 text-brand' : 'hover:bg-gray-900/50'
                    }`
                  }
                >
                  <item.icon size={24} />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Footer Log out */}
            <div className="mt-auto border-t border-gray-800 pt-4 pb-safe">
              <button className="text-red-500 font-medium p-3 w-full text-left hover:bg-gray-900/50 rounded-xl transition-colors">
                Log out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}