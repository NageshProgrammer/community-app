// src/components/feed/CreatePost.tsx
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Smile, MapPin } from 'lucide-react';

// Define the props we expect
interface CreatePostProps {
  onPost: (content: string, userId: string) => void;
  userId: string;
}

export function CreatePost({ onPost, userId }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePost = () => {
    if (!content.trim()) return;
    
    // Send the content and userId up to the Feed
    onPost(content, userId);
    
    // Reset the input area
    setContent('');
    setIsFocused(false);
    if (textareaRef.current) {
      textareaRef.current.blur();
    }
  };

  return (
    <div className="p-4 border-b border-gray-800 relative z-10 bg-dark">
      <div className="flex gap-4">
        <img 
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId || 'default'}`} 
          alt="Avatar" 
          className="w-12 h-12 rounded-full bg-gray-800 flex-shrink-0"
        />
        
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="What's happening?"
            className="w-full bg-transparent text-xl outline-none resize-none placeholder-gray-500 min-h-[60px]"
            rows={isFocused || content ? 3 : 1}
          />

          <AnimatePresence>
            {(isFocused || content) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800"
              >
                <div className="flex gap-2 text-brand">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 hover:bg-brand/10 rounded-full"><Image size={20} /></motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 hover:bg-brand/10 rounded-full"><Smile size={20} /></motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 hover:bg-brand/10 rounded-full"><MapPin size={20} /></motion.button>
                </div>

                <motion.button
                  onClick={handlePost}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={!content.trim()}
                  className="bg-brand text-white font-bold py-1.5 px-4 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
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