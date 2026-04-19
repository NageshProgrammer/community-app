// src/components/shared/PostModal.tsx
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, Smile, MapPin } from 'lucide-react';
import { usePosts } from '../../context/PostContext'; 
import { useAuth } from '../../context/AuthContext'; 
import { supabase } from '../../utils/supabase';

// A curated list of popular emojis for our custom picker
const POPULAR_EMOJIS = [
  // Smileys & Emotion
  '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','☺️','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🫣','🤗','🫡','🤔','🤭','🤫','🤥','😶','🫥','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','😵‍💫','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃',
  // Gestures & Hands
  '👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','👁','👀','👅','👄','💋','🩸',
  // Animals & Nature
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷','🕸','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿','🦔',
  // Food & Drink
  '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','🫖','☕️','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊'
];

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PostModal({ isOpen, onClose }: PostModalProps) {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [showEmojis, setShowEmojis] = useState(false); 
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { addPost } = usePosts();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchAvatar = async () => {
      if (!user?.id || !isOpen) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
          
        if (error) throw error;
        if (data?.avatar_url) {
          setAvatarUrl(data.avatar_url);
        }
      } catch (err) {
        console.error("Error fetching avatar:", err);
      }
    };
    
    fetchAvatar();
  }, [user?.id, isOpen]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImage(URL.createObjectURL(file));
  };

  const handleLocationClick = () => {
    const loc = prompt("Where are you posting this from?");
    if (loc) setLocation(loc);
  };

  const handleEmojiClick = (emoji: string) => {
    setContent(prev => prev + emoji);
  };

  const handlePost = () => {
    if (!content.trim() && !image) return;
    
    addPost(content, user?.id || '', image, location); 
    
    setContent('');
    setImage(null);
    setLocation(null);
    setShowEmojis(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { onClose(); setShowEmojis(false); }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex justify-center items-start sm:items-center pt-20 sm:pt-0"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, type: "spring", bounce: 0.25 }}
            className="fixed z-50 w-full max-w-[600px] bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 top-20 sm:top-auto sm:top-1/4 left-1/2 -translate-x-1/2 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-transparent relative z-20">
              <button onClick={() => { onClose(); setShowEmojis(false); }} className="p-2 text-gray-500 hover:text-brand hover:bg-gray-800 rounded-full transition-colors"><X size={20} /></button>
              <button className="text-brand font-bold text-sm hover:underline px-4 py-1.5 rounded-full hover:bg-brand/10 transition-colors">Drafts</button>
            </div>

            <div className="p-4 bg-transparent relative z-10">
              <div className="flex gap-4">
                {avatarUrl || user?.id ? (
                  <img 
                    src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || 'default'}`} 
                    alt="Avatar" 
                    className="w-12 h-12 rounded-full object-cover bg-gray-800 flex-shrink-0 shadow-sm" 
                  />
                ) : null}
                <div className="flex-1">
                  <textarea
                    ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)}
                    placeholder="What's happening?"
                    className="w-full bg-transparent text-xl text-white outline-none resize-none placeholder-gray-500 min-h-[120px] scrollbar-none"
                  />
                  
                  {/* Previews */}
                  <AnimatePresence>
                    {image && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="relative mt-2 rounded-2xl overflow-hidden border border-gray-800 w-fit max-w-full">
                        <img src={image} alt="Upload preview" className="max-h-[300px] object-cover" />
                        <button onClick={() => setImage(null)} className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black text-white rounded-full backdrop-blur-md transition-colors"><X size={16} /></button>
                      </motion.div>
                    )}
                    {location && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-brand/10 text-brand text-xs font-bold rounded-full">
                        <MapPin size={14} />{location}
                        <button onClick={() => setLocation(null)} className="ml-1 hover:text-white transition-colors"><X size={14} /></button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-800 flex items-center justify-between bg-transparent relative z-30">
              <div className="relative flex gap-2 text-brand">
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                <motion.button onClick={() => fileInputRef.current?.click()} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 hover:bg-gray-800 transition-colors rounded-full">
                  <ImageIcon size={20} />
                </motion.button>
                
                <motion.button 
                  onClick={() => setShowEmojis(!showEmojis)} 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.9 }} 
                  className={`p-2 transition-colors rounded-full ${showEmojis ? 'bg-brand/20 text-brand' : 'hover:bg-gray-800'}`}
                >
                  <Smile size={20} />
                </motion.button>
                
                <motion.button onClick={handleLocationClick} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 hover:bg-gray-800 transition-colors rounded-full">
                  <MapPin size={20} />
                </motion.button>

                {/* THE LIQUID GLASS EMOJI PICKER POPOVER */}
                <AnimatePresence>
                  {showEmojis && (
                    <>
                      {/* FIXED: Invisible full-screen overlay to close dropdown when clicking outside! */}
                      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowEmojis(false); }} />
                      
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        // FIXED: Styled for both light and dark themes using pure Tailwind
                        className="absolute bottom-12 left-0 w-64 max-h-48 overflow-y-auto scrollbar-none bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-2xl p-3 flex flex-wrap gap-1.5 z-50"
                      >
                        {POPULAR_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleEmojiClick(emoji)}
                            // FIXED: Hover styles adapt beautifully to light and dark themes
                            className="w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors hover:scale-110 active:scale-95"
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <motion.button
                onClick={handlePost} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={!content.trim() && !image}
                className="font-bold py-2 px-6 rounded-full shadow-md transition-colors disabled:bg-gray-800 disabled:text-gray-500 bg-brand text-brand-contrast disabled:cursor-not-allowed"
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