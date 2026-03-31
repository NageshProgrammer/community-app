import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSocial } from '../../context/SocialContext';

const WHO_TO_FOLLOW = [
  {
    id: '1',
    name: 'React',
    handle: 'reactjs',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=React',
  },
  {
    id: '2',
    name: 'Vite',
    handle: 'vite_js',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vite',
  },
  {
    id: '3',
    name: 'Tailwind CSS',
    handle: 'tailwindcss',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tailwind',
  },
];

export function RightSidebar() {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { followingIds, toggleFollow, searchQuery, setSearchQuery } = useSocial();

  return (
    <aside className="hidden lg:block w-80 p-4 h-screen sticky top-0 overflow-y-auto hide-scrollbar">
      
      {/* Search Bar */}
      <div className="sticky top-0 bg-dark pb-4 z-10 pt-2">
        <motion.div 
          animate={{
            borderColor: isSearchFocused ? 'var(--color-brand)' : '#1f2937', // gray-800
            backgroundColor: isSearchFocused ? 'transparent' : '#111827' // gray-900
          }}
          className="flex items-center gap-4 p-3 rounded-full border border-gray-800 bg-gray-900 transition-colors"
        >
          <Search size={20} className={isSearchFocused ? 'text-brand' : 'text-gray-500'} />
          <input
            type="text"
            placeholder="Search Community"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="bg-transparent border-none outline-none w-full text-white placeholder-gray-500"
          />
        </motion.div>
      </div>

      <div className="flex flex-col gap-4 text-white">
        {/* Trending Section */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <h2 className="text-xl font-bold mb-4 text-white">What's happening</h2>
          <div className="flex flex-col gap-4">
            <div onClick={() => setSearchQuery('#ReactJS')} className="hover:bg-gray-800/50 -mx-4 px-4 py-2 cursor-pointer transition-colors">
              <p className="text-xs text-gray-500">Trending in Tech</p>
              <p className="font-bold text-white">#ReactJS</p>
              <p className="text-xs text-gray-500">24.5K posts</p>
            </div>
            <div onClick={() => setSearchQuery('Tailwind V4')} className="hover:bg-gray-800/50 -mx-4 px-4 py-2 cursor-pointer transition-colors">
              <p className="text-xs text-gray-500">Trending</p>
              <p className="font-bold text-white">Tailwind V4</p>
              <p className="text-xs text-gray-500">12K posts</p>
            </div>
            <div onClick={() => setSearchQuery('Framer Motion')} className="hover:bg-gray-800/50 -mx-4 px-4 py-2 cursor-pointer transition-colors">
              <p className="text-xs text-gray-500">Design · Trending</p>
              <p className="font-bold text-white">Framer Motion</p>
              <p className="text-xs text-gray-500">8,230 posts</p>
            </div>
          </div>
        </div>

        {/* Who to follow Section */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 mb-4">
          <h2 className="text-xl font-bold mb-4">Who to follow</h2>
          <div className="flex flex-col gap-4">
            {WHO_TO_FOLLOW.map((user) => (
              <div key={user.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full bg-gray-800 flex-shrink-0" />
                  <div className="truncate">
                    <p className="font-bold text-sm text-white hover:underline cursor-pointer truncate">{user.name}</p>
                    <p className="text-gray-500 text-sm truncate">@{user.handle}</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleFollow(user.id)}
                  className={`font-bold text-sm py-1.5 px-4 rounded-full flex-shrink-0 transition-all ${
                    followingIds.some(fid => fid.toLowerCase() === user.id.toLowerCase()) 
                      ? 'bg-transparent border border-gray-700 text-white hover:border-red-500 hover:text-red-500 group/btn' 
                      : 'bg-white text-black hover:bg-gray-200'
                  }`}
                >
                  {followingIds.some(fid => fid.toLowerCase() === user.id.toLowerCase()) ? (
                    <>
                      <span className="group-hover/btn:hidden">Following</span>
                      <span className="hidden group-hover/btn:inline">Unfollow</span>
                    </>
                  ) : 'Follow'}
                </motion.button>
              </div>
            ))}
          </div>
        </div>
        
      </div>
    </aside>
  );
}