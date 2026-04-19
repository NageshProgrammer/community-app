import { Search, Globe, Zap, Users, MoreHorizontal, ArrowUpRight } from 'lucide-react';
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
  const { followingIds, searchQuery, setSearchQuery } = useSocial();

  return (
    <aside className="hidden lg:block w-80 p-4 h-screen sticky top-0 overflow-y-auto hide-scrollbar">
      
      {/* Search Bar */}
      <div className="sticky top-0 bg-black/80 pb-4 z-50 pt-2 backdrop-blur-xl -mx-4 px-4">
        <div 
          className={`flex items-center gap-4 p-3 rounded-full border transition-colors duration-200 ${
            isSearchFocused ? 'border-brand bg-transparent' : 'bg-gray-900 border-gray-800'
          }`}
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
        </div>
      </div>

      <div className="flex flex-col gap-5 text-white">
        {/* Worldwide Status */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-brand/5 border border-brand/20 p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Global Activity</span>
            </div>
            <Globe size={12} className="text-gray-500" />
          </div>
          <p className="text-lg font-bold text-white tracking-tight">4,281 Members Online</p>
          <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: '65%' }}
               className="h-full bg-brand"
             />
          </div>
        </div>

        {/* Global Hubs Section */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 flex items-center justify-between border-b border-white/5">
            <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Zap size={16} className="text-amber-400 fill-amber-400" /> Discover Hubs
            </h2>
          </div>
          <div className="flex flex-col">
            {[
              { name: 'Global Tech', posts: '12.4K', color: 'text-blue-400', bg: 'bg-blue-400/10' },
              { name: 'Startup Lounge', posts: '8.2K', color: 'text-purple-400', bg: 'bg-purple-400/10' },
              { name: 'Future Design', posts: '5.1K', color: 'text-green-400', bg: 'bg-green-400/10' },
            ].map((hub) => (
              <div 
                key={hub.name}
                onClick={() => setSearchQuery(hub.name)}
                className="group p-4 hover:bg-white/5 cursor-pointer transition-all border-b border-white/5 last:border-none"
              >
                <div className="flex items-center justify-between mb-1.5">
                   <div className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-tight ${hub.bg} ${hub.color}`}>
                     # {hub.name.replace(' ', '')}
                   </div>
                   <ArrowUpRight size={14} className="text-gray-700 group-hover:text-white transition-colors" />
                </div>
                <div className="flex justify-between items-center">
                  <p className="font-bold text-[15px] text-white group-hover:text-brand transition-colors tracking-tight">{hub.name}</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{hub.posts} Active</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full p-4 text-xs font-black uppercase tracking-widest text-brand hover:bg-brand/10 transition-all text-center cursor-pointer">
            Explore more
          </button>
        </div>

        {/* Who to follow Section */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-2xl">
          <h2 className="text-sm font-black uppercase tracking-widest mb-5 text-white flex items-center gap-2">
            <Users size={16} className="text-blue-500" /> People to Know
          </h2>
          <div className="flex flex-col gap-5">
            {WHO_TO_FOLLOW.map((user) => {
              const isFollowing = followingIds.some(fid => fid.toLowerCase() === user.id.toLowerCase());
              
              return (
                <div key={user.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="relative">
                      <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full bg-gray-800 flex-shrink-0 group-hover:scale-105 transition-transform" />
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-black rounded-full" />
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-[14px] text-white hover:underline cursor-pointer truncate leading-tight">{user.name}</p>
                      <p className="text-gray-500 text-xs truncate font-medium">@{user.handle}</p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`font-black text-[11px] uppercase tracking-wider py-1.5 px-4 rounded-lg flex-shrink-0 transition-all cursor-pointer ${
                      isFollowing 
                        ? 'bg-white/5 text-white hover:bg-red-500/10 hover:text-red-500' 
                        : 'bg-white text-black hover:bg-brand hover:text-white'
                    }`}
                  >
                    {isFollowing ? 'Joined' : 'Join'}
                  </motion.button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}