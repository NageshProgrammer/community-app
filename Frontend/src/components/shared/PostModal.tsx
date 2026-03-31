// src/components/shared/PostModal.tsx
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, Smile, MapPin } from 'lucide-react';
import { usePosts } from '../../context/PostContext'; // <-- Import context
import { useAuth } from '../../context/AuthContext'; // <-- Import auth

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PostModal({ isOpen, onClose }: PostModalProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Grab the global addPost function and user!
  const { addPost } = usePosts();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handlePost = () => {
    if (!content.trim()) return;
    
    addPost(content, user?.id || ''); // <-- Actually add the post to the global state!
    
    setContent('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-start sm:items-center pt-20 sm:pt-0"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed z-50 w-full max-w-[600px] bg-dark rounded-2xl shadow-2xl border border-gray-800 top-20 sm:top-auto sm:top-1/4 left-1/2 -translate-x-1/2 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <button 
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              <button className="text-brand font-bold text-sm hover:underline">Drafts</button>
            </div>

            <div className="p-4">
              <div className="flex gap-4">
                <img 
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=Narayan" 
                  alt="Avatar" 
                  className="w-12 h-12 rounded-full bg-gray-800 flex-shrink-0"
                />
                <div className="flex-1">
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="What's happening?"
                    className="w-full bg-transparent text-xl outline-none resize-none placeholder-gray-500 min-h-[120px]"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-800 flex items-center justify-between bg-gray-900/30">
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
                className="bg-brand text-white font-bold py-2 px-6 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}