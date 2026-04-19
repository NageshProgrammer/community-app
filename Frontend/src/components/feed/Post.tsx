import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Repeat, Heart, Share, MoreHorizontal, MapPin, Trash2, Link as LinkIcon, Send, Pencil, X } from 'lucide-react';
import { usePosts, type CommentData, type PostData } from '../../context/PostContext';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface PostProps {
  post: PostData;
  index: number;
  onLike: () => void;
  onComment: (comment: string) => void;
  onDelete?: () => void; 
  onEdit?: (newContent: string) => Promise<void>; 
  activeDropdownId: string | null;
  setActiveDropdownId: (id: string | null) => void;
}

export function Post({ post, index, onLike, onComment, onDelete, onEdit, activeDropdownId, setActiveDropdownId }: PostProps) {
  const [commentText, setCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [repostMenuOpen] = useState(false);
  
  // Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  
  const { getComments, quoteRepost } = usePosts();
  const { user } = useAuth();
  const [, setSearchParams] = useSearchParams();

  const [comments, setComments] = useState<CommentData[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isOwnPost = (user?.id === post.author?.id) || 
                    (user?.id === post.author_id);

  const showOptions = activeDropdownId === post.id;
  const showShareOptions = activeDropdownId === post.id + '-share';

  // FIX: Determine if this specific post's dropdown or share menu or repost menu is open
  const isAnyMenuOpen = showOptions || showShareOptions || repostMenuOpen;

  useEffect(() => {
    if (showCommentInput) {
      const fetchComments = async () => {
        setLoadingComments(true);
        const data = await getComments(post.id);
        setComments(data);
        setLoadingComments(false);
      };
      fetchComments();
    }
  }, [showCommentInput, post.id, getComments]);

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommentText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    await onComment(commentText.trim());
    setCommentText('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const data = await getComments(post.id);
    setComments(data);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/community?shared=${post.id}`;
    navigator.clipboard.writeText(url);
    setActiveDropdownId(null);
  };

  const handleToggleOptions = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showOptions) {
      setActiveDropdownId(null);
    } else {
      setActiveDropdownId(post.id); 
    }
  };

  const handleToggleShare = () => {
    if (showShareOptions) {
      setActiveDropdownId(null);
    } else {
      setActiveDropdownId(post.id + '-share');
    }
  };

  // Edit Logic
  const handleInitiateEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check if 5 minutes have passed
    const postTime = new Date(post.created_at).getTime();
    const currentTime = new Date().getTime();
    const diffInMinutes = (currentTime - postTime) / (1000 * 60);

    if (diffInMinutes > 5) {
      alert("Posts cannot be edited after 5 minutes of being published.");
    } else {
      setEditContent(post.content);
      setIsEditing(true);
    }
    setActiveDropdownId(null);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === post.content) {
      setIsEditing(false);
      return;
    }
    
    setIsSubmittingEdit(true);
    try {
      if (onEdit) await onEdit(editContent.trim());
      setIsEditing(false);
    } catch (error) {
      alert("Failed to edit post. Please try again.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const shareToPlatform = (platform: 'whatsapp' | 'telegram' | 'messenger' | 'copy') => {
    const url = `${window.location.origin}/community?shared=${post.id}`;
    const text = `Check out this post on Community: ${post.content.substring(0, 100)}...`;

    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
        break;
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
        break;
      case 'messenger':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'copy':
        handleCopyLink();
        break;
    }
    setActiveDropdownId(null);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`p-4 border-b border-gray-800 hover:bg-gray-800 transition-colors relative ${isAnyMenuOpen ? 'z-50' : 'z-10'}`}
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <Link to={`/profile/${post.author.id}`} className="flex-shrink-0">
          {post.author.avatar && (
            <img
              src={post.author.avatar}
              alt={post.author.name}
              className="w-12 h-12 rounded-full object-cover bg-gray-800 hover:opacity-80 transition-opacity shadow-sm"
            />
          )}
        </Link>

        <div className="flex-1">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <Link to={`/profile/${post.author.id}`} className="text-white font-bold hover:underline">
                {post.author.name}
              </Link>
              <span className="text-gray-400 ml-2 font-medium">@{post.author.handle}</span>
              <span className="text-gray-500 mx-1">·</span>
              <span className="text-gray-400 hover:underline">{post.timestamp}</span>
              {post.is_edited && (
                <span className="text-gray-500 text-xs ml-2 italic">(Edited)</span>
              )}
            </div>

            {/* OPTIONS MENU WRAPPER */}
            <div className="relative z-50">
              <motion.button
                onClick={handleToggleOptions}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`p-2 rounded-full transition-colors cursor-pointer ${showOptions ? 'bg-brand/20 text-brand' : 'text-gray-400 hover:bg-gray-700 hover:text-brand'}`}
              >
                <MoreHorizontal size={20} />
              </motion.button>

              <AnimatePresence>
                {showOptions && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveDropdownId(null); }} />

                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-10 w-48 bg-white/10 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden z-50 py-1"
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyLink(); }}
                        className="w-full text-left px-4 py-3  cursor-pointer hover:bg-white/5 dark:text-white text-sm font-medium transition-colors flex items-center gap-3 group"
                      >
                        <LinkIcon size={16} className="text-gray-500 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-gray-300 transition-colors " /> Copy Link
                      </button>

                      {isOwnPost && (
                        <>
                          <button 
                            onClick={handleInitiateEdit}
                            className="w-full text-left px-4 py-3  cursor-pointer hover:bg-white/5 dark:text-white text-sm font-medium transition-colors flex items-center gap-3 group"
                          >
                            <Pencil size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors " /> Edit Post
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveDropdownId(null); onDelete && onDelete(); }}
                            className="w-full text-left px-4 py-3 hover:bg-red-50 cursor-pointer dark:hover:bg-red-500/10 text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 text-sm font-medium transition-colors flex items-center gap-3 group"
                          >
                            <Trash2 size={16} className="transition-colors " /> Delete Post
                          </button>
                        </>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {post.reposted_post_id && !post.content && (
             <div className="flex items-center gap-2 mb-2 -mt-1 opacity-70">
                <Repeat size={14} className="text-gray-400" />
                <span className="text-[13px] text-gray-400 font-bold hover:underline cursor-pointer">{post.author.name} Reposted</span>
             </div>
          )}

          {/* EDIT OR DISPLAY CONTENT */}
          {post.content && (
            isEditing ? (
              <div className="mt-3 bg-gray-800/50 rounded-2xl border border-gray-700 p-3">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-transparent border-none focus:outline-none text-white text-[15px] resize-none min-h-[80px]"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-1.5 rounded-full text-sm font-bold text-gray-400 hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveEdit}
                    disabled={isSubmittingEdit || !editContent.trim()}
                    className="px-4 py-1.5 rounded-full text-sm font-bold bg-brand text-brand-contrast hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isSubmittingEdit ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap text-gray-100">
                {post.content}
              </p>
            )
          )}

          {/* RENDER ORIGINAL POST (If Quote Repost) */}
          {post.original_post && (
            <div 
               onClick={(e) => {
                  e.stopPropagation();
                  setSearchParams({ shared: post.original_post!.id });
               }}
               className="mt-3 p-3 rounded-2xl border border-gray-800 bg-black/10 hover:bg-white/5 transition-colors cursor-pointer overflow-hidden group/quoted"
            >
              <div className="flex items-center gap-2 mb-1">
                {post.original_post.author.avatar && (
                  <img src={post.original_post.author.avatar} className="w-5 h-5 rounded-full" />
                )}
                <span className="text-sm font-bold text-white group-hover/quoted:underline">{post.original_post.author.name}</span>
                <span className="text-xs text-gray-500">@{post.original_post.author.handle}</span>
              </div>
              <p className="text-[14px] text-gray-300 line-clamp-3 leading-snug">
                {post.original_post.content}
              </p>
              {post.original_post.image && (
                <div className="mt-2 rounded-xl overflow-hidden h-32 w-full">
                  <img src={post.original_post.image} className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          )}

          {post.image && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-gray-800">
              <img src={post.image} alt="Post attachment" className="w-full h-auto max-h-[500px] object-cover" />
            </div>
          )}

          {post.location && (
            <div className="flex items-center gap-1 mt-3 text-brand font-medium text-sm">
              <MapPin size={16} />
              <span>{post.location}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between mt-4 text-gray-400 max-w-md">
            <ActionIcon icon={MessageCircle} count={post.comments} hoverColor="hover:text-blue-500" hoverBg="group-hover:bg-blue-500/10" activeBg="bg-blue-500/10" isActive={showCommentInput} activeColor="text-blue-500" onClick={() => setShowCommentInput((prev) => !prev)} />

            <div className="relative">
              <ActionIcon 
                icon={Repeat} 
                count={post.reposts} 
                hoverColor="hover:text-green-500" 
                hoverBg="group-hover:bg-green-500/10" 
                activeBg="bg-green-500/10" 
                isActive={post.isReposted ?? false} 
                activeColor="text-green-500" 
                onClick={() => setShowQuoteModal(true)} 
              />
            </div>
            <ActionIcon icon={Heart} count={post.likes} hoverColor="hover:text-pink-500" hoverBg="group-hover:bg-pink-500/10" activeBg="bg-pink-500/10" isActive={post.isLiked ?? false} activeColor="text-pink-500" fillIcon={post.isLiked ?? false} onClick={onLike} />

            {/* Share Wrapper */}
            <div className="relative">
              <ActionIcon icon={Share} hoverColor="hover:text-brand" hoverBg="group-hover:bg-brand/10" activeBg="bg-brand/10" isActive={showShareOptions} activeColor="text-brand" onClick={handleToggleShare} />

              <AnimatePresence>
                {showShareOptions && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveDropdownId(null); }} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute bottom-full mb-2 left-0 w-44 bg-white/10 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden z-50 p-1"
                    >
                      <button onClick={() => shareToPlatform('whatsapp')} className="w-full flex items-center gap-3 px-4 py-2.5 dark:hover:bg-white/15 dark:text-gray-200 rounded-xl transition-colors text-sm font-medium ">
                        <MessageCircle size={16} className="text-green-500" /> WhatsApp
                      </button>
                      <button onClick={() => shareToPlatform('telegram')} className="w-full flex items-center gap-3 px-4 py-2.5 dark:hover:bg-white/15 dark:text-gray-200 rounded-xl transition-colors text-sm font-medium ">
                        <Send size={16} className="text-blue-400" /> Telegram
                      </button>
                      <button onClick={() => shareToPlatform('messenger')} className="w-full flex items-center gap-3 px-4 py-2.5 dark:hover:bg-white/15 dark:text-gray-200 rounded-xl transition-colors text-sm font-medium ">
                        <Share size={16} className="text-blue-600" /> Messenger
                      </button>
                      <hr className="my-1 border-gray-200 dark:border-gray-800" />
                      <button onClick={() => shareToPlatform('copy')} className="w-full flex items-center gap-3 px-4 py-2.5 dark:hover:bg-white/15 dark:text-gray-200 rounded-xl transition-colors text-sm font-medium ">
                        <LinkIcon size={16} className="text-gray-400" /> Copy Link
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence>
            {showCommentInput && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-4 space-y-4 border-l-2 border-gray-800 ml-2 pl-4">
                  {loadingComments ? (
                    <p className="text-gray-500 text-sm">Loading comments...</p>
                  ) : comments.length > 0 ? (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Link to={`/profile/${comment.author.id}`}>
                          <img src={comment.author.avatar} className="w-8 h-8 rounded-full bg-gray-800 hover:opacity-80 transition-opacity" alt={comment.author.name} />
                        </Link>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Link to={`/profile/${comment.author.id}`} className="text-white font-bold text-sm hover:underline">{comment.author.name}</Link>
                            <span className="text-gray-500 text-xs font-medium">@{comment.author.handle}</span>
                          </div>
                          <p className="text-gray-200 text-sm mt-0.5">{comment.content}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm italic">No comments yet. Be the first!</p>
                  )}
                </div>

                <div className="mt-4 flex gap-3 items-end bg-transparent">
                  <div className="flex-1 relative bg-gray-800 rounded-2xl border border-gray-800/50 shadow-inner transition-all overflow-hidden">
                    <textarea
                      ref={textareaRef} rows={1} value={commentText} onChange={handleCommentChange}
                      className="w-full bg-transparent py-3 px-4 text-white focus:outline-none text-sm resize-none max-h-[120px] scrollbar-thin scrollbar-thumb-gray-700 block"
                      placeholder="Write a reply..." style={{ minHeight: '44px' }}
                    />
                  </div>
                  <motion.button
                    type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={submitComment} disabled={!commentText.trim()}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold shadow-md transition-all h-fit mb-[2px] ${commentText.trim() ? 'bg-brand text-brand-contrast hover:opacity-90' : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      }`}
                  >
                    Reply
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Quote Repost Modal */}
      <AnimatePresence>
        {showQuoteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowQuoteModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-[#15202B] rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col p-4">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white">Repost</h3>
                  <button onClick={() => setShowQuoteModal(false)} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"><X size={20} /></button>
               </div>
               
               <div className="flex gap-4">
                  <div className="flex-1">
                     <textarea
                        value={quoteText}
                        onChange={(e) => setQuoteText(e.target.value)}
                        placeholder="Add a comment... (optional)"
                        className="w-full bg-transparent border-none text-xl text-white focus:outline-none resize-none min-h-[120px]"
                        autoFocus
                     />
                     
                     {/* Original Post Preview inside Repost Modal */}
                     <div className="mt-4 p-4 rounded-2xl border border-gray-800 bg-black/20 overflow-hidden">
                        <div className="flex items-center gap-2 mb-2">
                           {post.author.avatar && (
                             <img src={post.author.avatar} className="w-5 h-5 rounded-full" />
                           )}
                           <span className="text-sm font-bold text-white">{post.author.name}</span>
                           <span className="text-xs text-gray-500">@{post.author.handle}</span>
                        </div>
                        <p className="text-[14px] text-gray-300 line-clamp-3 mb-2">{post.content}</p>
                        {post.image && (
                          <img src={post.image} className="w-full h-32 object-cover rounded-xl" />
                        )}
                     </div>
                  </div>
               </div>
               
               <div className="mt-6 flex justify-end">
                  <button
                    onClick={async () => {
                       await quoteRepost(post.id, quoteText.trim());
                       setQuoteText('');
                       setShowQuoteModal(false);
                    }}
                    className={`px-8 py-2.5 rounded-full font-bold transition-all bg-brand text-brand-contrast hover:opacity-90`}
                  >
                    Post
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

interface ActionIconProps {
  icon: React.ComponentType<{ className?: string; size?: number; fill?: string }>;
  count?: number;
  hoverColor: string;
  hoverBg: string;
  activeBg: string;
  isActive?: boolean;
  activeColor?: string;
  fillIcon?: boolean;
  onClick?: () => void;
}

function ActionIcon({ icon: Icon, count, hoverColor, hoverBg, activeBg, isActive = false, activeColor = '', fillIcon = false, onClick }: ActionIconProps) {
  return (
    <motion.button
      onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }}
      className={`cursor-pointer flex items-center gap-1.5 group transition-colors duration-300 ${hoverColor} ${isActive ? activeColor : ''}`}
      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
    >
      <div className={`p-2 rounded-full transition-all duration-300 ${hoverBg} ${isActive ? activeBg : 'bg-transparent'}`}>
        <motion.div
          initial={false}
          animate={isActive ? { scale: [1, 1.5, 0.85, 1.15, 1], rotate: [0, -10, 10, -5, 0] } : { scale: 1, rotate: 0 }}
          transition={{ duration: 0.5, type: "spring", bounce: 0.6 }}
        >
          <Icon className={`w-[18px] h-[18px] transition-colors duration-300`} fill={fillIcon ? "currentColor" : "none"} />
        </motion.div>
      </div>
      {count !== undefined && (
        <div className="overflow-hidden h-5 flex items-center relative min-w-[20px]">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={count} initial={{ y: 15, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -15, opacity: 0, scale: 0.8 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="text-sm font-medium text-left absolute"
            >
              {count}
            </motion.span>
          </AnimatePresence>
        </div>
      )}
    </motion.button>
  );
}