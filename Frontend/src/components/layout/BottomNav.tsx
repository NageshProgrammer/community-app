// src/components/layout/BottomNav.tsx
import { Home, Bell, MessageSquare, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';

const navItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Bell, label: 'Notifications', path: '/notifications' },
  { icon: MessageSquare, label: 'Messages', path: '/messages' },
  { icon: User, label: 'Profile', path: '/profile' },
];

export function BottomNav() {
  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-dark/90 backdrop-blur-md border-t border-gray-800 flex justify-around p-2 z-50 pb-safe">
      {navItems.map((item) => (
        <NavLink key={item.label} to={item.path}>
          {({ isActive }) => (
            <motion.div
              whileTap={{ scale: 0.8 }}
              className="p-3 flex flex-col items-center gap-1"
            >
              <item.icon 
                size={26} 
                className={isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'} 
                fill={isActive ? 'currentColor' : 'none'}
              />
            </motion.div>
          )}
        </NavLink>
      ))}
    </div>
  );
}