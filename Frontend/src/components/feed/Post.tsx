import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Repeat, Heart, Share, MoreHorizontal, MapPin, Trash2, Link as LinkIcon, Send, Pencil, Smile, Image, Globe } from 'lucide-react';
import { usePosts, type CommentData, type PostData } from '../../context/PostContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

interface PostProps {
  post: PostData;
  index: number;
  onLike: () => void;
  onRepost: () => void;
  onComment: (comment: string) => void;
  onDelete?: () => void;
  onEdit?: (newContent: string) => Promise<void>;
  activeDropdownId: string | null;
  setActiveDropdownId: (id: string | null) => void;
}

export function Post({ post, index, onLike, onRepost, onComment, onDelete, onEdit, activeDropdownId, setActiveDropdownId }: PostProps) {
  const { showNotification } = useNotification();
  const [commentText, setCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [repostMenuOpen, setRepostMenuOpen] = useState(false);
  const [quoteImage, setQuoteImage] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emojis = ['😊', '😂', '🔥', '🙌', '💯', '✨', '👀', '🤔', '❤️', '👍'];

  const handleLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const loc = `📍 ${position.coords.latitude.toFixed(2)}, ${position.coords.longitude.toFixed(2)}`;
        setQuoteText(prev => prev + " " + loc);
      }, (err) => {
        showNotification("Could not get location: " + err.message, 'error');
      });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setQuoteImage(url);
    }
  };

  // Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const { getComments, quoteRepost } = usePosts();
  const { user } = useAuth();

  const [comments, setComments] = useState<CommentData[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isOwnPost = user?.id === post.author.id;

  const showOptions = activeDropdownId === post.id;
  const showShareOptions = activeDropdownId === post.id + '-share';

  // FIX: Determine if this specific post needs to be pulled to the front
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
    showNotification("Link copied to clipboard!", 'success');
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
      showNotification("Posts cannot be edited after 5 minutes of being published.", 'warning');
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
      showNotification("Failed to edit post. Please try again.", 'error');
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
      className={`p-4 border-b border-gray-100 dark:border-[rgb(47,51,54)] hover:bg-black/5 dark:hover:bg-white/[0.03] transition-colors relative ${isAnyMenuOpen ? 'z-50' : 'z-10'}`}
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
            <div className="flex items-center gap-2 mb-1 -mt-1">
              <Repeat size={12} className="text-gray-500" />
              <span className="text-[12px] text-gray-500 font-bold uppercase tracking-wider">{post.author.name} Reposted</span>
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
            <div className="mt-3 p-3 rounded-2xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                {post.original_post.author.avatar && (
                  <img src={post.original_post.author.avatar} className="w-5 h-5 rounded-full" />
                )}
                <span className="text-sm font-bold text-white uppercase tracking-tight">{post.original_post.author.name}</span>
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
              <ActionIcon icon={Repeat} count={post.reposts} hoverColor="hover:text-green-500" hoverBg="group-hover:bg-green-500/10" activeBg="bg-green-500/10" isActive={post.isReposted ?? false} activeColor="text-green-500" onClick={() => setRepostMenuOpen(!repostMenuOpen)} />

              <AnimatePresence>
                {repostMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setRepostMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute bottom-full mb-2 left-0 w-44 bg-white dark:bg-[#15202B]/95 backdrop-blur-xl border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden z-50 p-1"
                    >
                      <button
                        onClick={() => { onRepost(); setRepostMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors text-sm font-bold text-gray-700 dark:text-gray-200"
                      >
                        <Repeat size={18} /> {post.isReposted ? 'Undo Repost' : 'Repost'}
                      </button>
                      <button
                        onClick={() => { setShowQuoteModal(true); setRepostMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors text-sm font-bold text-gray-700 dark:text-gray-200"
                      >
                        <MessageCircle size={18} /> Quote
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
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

      {/* Quote Repost Modal (Portaled) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showQuoteModal && (
            <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-8 sm:pt-16 px-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowQuoteModal(false)}
                className="absolute inset-0 bg-[#5b7083]/40 backdrop-blur-[2px]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="relative w-full max-w-[600px] bg-black rounded-2xl shadow-2xl flex flex-col p-4 border border-none"
              >
                {/* X Modal Header */}
                <div className="flex justify-between items-center mb-1">
                  <button
                    onClick={() => setShowQuoteModal(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button className="text-[rgb(29,155,240)] text-sm font-bold hover:bg-[rgb(29,155,240)]/10 px-3 py-1 rounded-full transition-colors">Drafts</button>
                </div>

                <div className="flex gap-3">
                  <input
                    type="file"
                    hidden
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <div className="flex-shrink-0 pt-1">
                    <div className="w-10 h-10 rounded-full bg-[#00ba7c] flex items-center justify-center text-white font-bold text-lg select-none">
                      {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'N'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={quoteText}
                      onChange={(e) => setQuoteText(e.target.value)}
                      placeholder="Add a comment"
                      className="w-full bg-transparent border-none text-xl text-white placeholder-[#536471] focus:outline-none resize-none min-h-[50px] mt-1 leading-normal"
                      autoFocus
                    />

                    {/* Quoted Post Preview (X Pro Style) */}
                    <div className="mt-2 p-3 rounded-2xl border border-[rgb(47,51,54)] bg-transparent hover:bg-white/5 transition-colors overflow-hidden">
                      <div className="flex items-center gap-2 mb-0.5">
                        {post.author.avatar && (
                          <img src={post.author.avatar} className="w-5 h-5 rounded-full" />
                        )}
                        <span className="text-[15px] font-bold text-white tracking-tight">{post.author.name}</span>
                        <span className="text-[15px] text-[#536471] font-medium">@{post.author.handle} · {post.timestamp}</span>
                      </div>
                      <p className="text-[15px] text-white mt-0.5 font-normal leading-normal">{post.content}</p>
                      {post.image && (
                        <div className="mt-2 rounded-xl border border-[rgb(47,51,54)] overflow-hidden">
                          <img src={post.image} className="w-full h-auto object-cover max-h-[300px]" />
                        </div>
                      )}
                    </div>

                    {/* Image Preview */}
                    {quoteImage && (
                      <div className="relative mt-2 rounded-2xl overflow-hidden border border-[rgb(47,51,54)]">
                        <img src={quoteImage} className="w-full h-auto max-h-[250px] object-cover" />
                        <button
                          onClick={() => setQuoteImage(null)}
                          className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}

                    <hr className="mt-4 border-[rgb(47,51,54)]" />

                    <div className="mt-3 flex justify-between items-center relative">
                      <div className="flex items-center gap-1 -ml-2">
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 text-[rgb(29,155,240)] hover:bg-[rgb(29,155,240)]/10 rounded-full transition-colors"><Image size={20} /></button>
                        <button onClick={() => setQuoteText(prev => prev + "\n1. Option A\n2. Option B")} className="p-2 text-[rgb(29,155,240)] hover:bg-[rgb(29,155,240)]/10 rounded-full transition-colors"><Pencil size={20} /></button>
                        <div className="relative">
                          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-[rgb(29,155,240)] hover:bg-[rgb(29,155,240)]/10 rounded-full transition-colors"><Smile size={20} /></button>
                          {showEmojiPicker && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              className="absolute bottom-full mb-2 left-0 bg-gray-900 border border-gray-800 rounded-xl p-2 flex gap-2 shadow-2xl z-[101]"
                            >
                              {emojis.map(e => (
                                <button key={e} onClick={() => { setQuoteText(prev => prev + e); setShowEmojiPicker(false); }} className="hover:scale-125 transition-transform">{e}</button>
                              ))}
                            </motion.div>
                          )}
                        </div>
                        <button onClick={handleLocation} className="p-2 text-[rgb(29,155,240)] hover:bg-[rgb(29,155,240)]/10 rounded-full transition-colors"><MapPin size={20} /></button>
                      </div>
                      <button
                        onClick={async () => {
                          if (!quoteText.trim() && !quoteImage) return;
                          await quoteRepost(post.id, quoteText.trim(), quoteImage);
                          setQuoteText('');
                          setQuoteImage(null);
                          setShowQuoteModal(false);
                        }}
                        disabled={!quoteText.trim() && !quoteImage}
                        className={`px-5 py-2 rounded-full font-bold text-[15px] transition-all ${(quoteText.trim() || quoteImage)
                            ? 'bg-[rgb(29,155,240)] text-white hover:bg-[rgb(26,140,216)] shadow-sm'
                            : 'bg-[rgb(29,155,240)]/50 text-white/50 cursor-not-allowed'
                          }`}
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

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
