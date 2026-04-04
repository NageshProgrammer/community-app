// src/components/feed/CreatePost.tsx
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Smile, MapPin, X } from 'lucide-react';

interface CreatePostProps {
  onPost: (content: string, userId: string, image?: string | null, location?: string | null) => void;
  userId: string;
}

export function CreatePost({ onPost, userId }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(URL.createObjectURL(file));
    }
  };

  const handleLocationClick = () => {
    const loc = prompt("Where are you posting this from?");
    if (loc) setLocation(loc);
  };

  const handlePost = () => {
    if (!content.trim() && !image) return;
    
    onPost(content, userId, image, location);
    
    setContent('');
    setImage(null);
    setLocation(null);
    setIsFocused(false);
    if (textareaRef.current) textareaRef.current.blur();
  };

  return (
    <div className="p-4 border-b border-gray-800 relative z-10 bg-transparent">
      <div className="flex gap-4">
        <img 
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId || 'default'}`} 
          alt="Avatar" 
          className="w-12 h-12 rounded-full bg-gray-800 flex-shrink-0 shadow-sm"
        />
        
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="What's happening?"
            className="w-full bg-transparent text-xl text-white outline-none resize-none placeholder-gray-500 min-h-[60px] scrollbar-none"
            rows={isFocused || content || image ? 3 : 1}
          />

          {/* Previews for Image and Location */}
          <AnimatePresence>
            {image && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="relative mt-2 rounded-2xl overflow-hidden border border-gray-800 w-fit max-w-full">
                <img src={image} alt="Upload preview" className="max-h-[300px] object-cover" />
                <button onClick={() => setImage(null)} className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black text-white rounded-full backdrop-blur-md transition-colors">
                  <X size={16} />
                </button>
              </motion.div>
            )}
            
            {location && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-brand/10 text-brand text-xs font-bold rounded-full">
                <MapPin size={14} />
                {location}
                <button onClick={() => setLocation(null)} className="ml-1 hover:text-white transition-colors"><X size={14} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {(isFocused || content || image) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800 overflow-hidden"
              >
                <div className="flex gap-2 text-brand">
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                  <motion.button onClick={() => fileInputRef.current?.click()} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 hover:bg-gray-800 transition-colors rounded-full"><ImageIcon size={20} /></motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 hover:bg-gray-800 transition-colors rounded-full"><Smile size={20} /></motion.button>
                  <motion.button onClick={handleLocationClick} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 hover:bg-gray-800 transition-colors rounded-full"><MapPin size={20} /></motion.button>
                </div>

                <motion.button
                  onClick={handlePost}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={!content.trim() && !image}
                  // FIXED: Explicit disabled styling to prevent invisible text
                  className="font-bold py-1.5 px-5 rounded-full shadow-md transition-colors disabled:bg-gray-800 disabled:text-gray-500 bg-brand text-brand-contrast disabled:cursor-not-allowed"
                >
                  Post
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}