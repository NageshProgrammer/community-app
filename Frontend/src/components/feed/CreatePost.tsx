// src/components/feed/CreatePost.tsx
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Smile, MapPin, X } from 'lucide-react';
import { supabase } from '../../utils/supabase'; 

// Over 250+ popular emojis covering multiple categories!
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

interface CreatePostProps {
  onPost: (content: string, userId: string, image?: string | null, location?: string | null) => void;
  userId: string;
}

export function CreatePost({ onPost, userId }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [showEmojis, setShowEmojis] = useState(false); 
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchAvatar = async () => {
      if (!userId) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', userId)
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
  }, [userId]);

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

  const handleEmojiClick = (emoji: string) => {
    setContent(prev => prev + emoji);
  };

  const handlePost = () => {
    if (!content.trim() && !image) return;
    
    onPost(content, userId, image, location);
    
    setContent('');
    setImage(null);
    setLocation(null);
    setIsFocused(false);
    setShowEmojis(false);
    if (textareaRef.current) textareaRef.current.blur();
  };

  return (
    <div className="p-4 border-b border-gray-800 relative z-20 bg-transparent">
      <div className="flex gap-4">
        <img 
          src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId || 'default'}`} 
          alt="Avatar" 
          className="w-12 h-12 rounded-full object-cover bg-gray-800 flex-shrink-0 shadow-sm"
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
                className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800 overflow-visible relative"
              >
                {/* Relative container for tools so Emoji picker anchors here */}
                <div className="flex gap-2 text-brand relative">
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                  
                  <motion.button onClick={() => fileInputRef.current?.click()} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 hover:bg-gray-800 transition-colors rounded-full">
                    <ImageIcon size={20} />
                  </motion.button>
                  
                  {/* Emoji Toggle Button */}
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

                  {/* LIQUID GLASS EMOJI PICKER POPOVER */}
                  <AnimatePresence>
                    {showEmojis && (
                      <>
                        {/* FIXED: Invisible full-screen overlay to close dropdown when clicking outside! */}
                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowEmojis(false); }} />
                        
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          // FIXED: Light and Dark theme styling applied
                          className="absolute top-12 left-0 w-72 max-h-56 overflow-y-auto scrollbar-none bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-2xl p-3 flex flex-wrap gap-1.5 z-50"
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
                  onClick={handlePost}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={!content.trim() && !image}
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