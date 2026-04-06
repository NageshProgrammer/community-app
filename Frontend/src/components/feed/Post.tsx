import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Repeat, Heart, Share, MoreHorizontal, MapPin } from 'lucide-react';
import { usePosts, type CommentData } from '../../context/PostContext';
import { Link } from 'react-router-dom';

export interface PostData {
  id: string;
  author: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
  };
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  reposts: number;
  isLiked?: boolean;
  isReposted?: boolean;
  image?: string | null;     
  location?: string | null;  
}

interface PostProps {
  post: PostData;
  index: number;
  onLike: () => void;
  onRepost: () => void;
  onComment: (comment: string) => void;
  onShare: () => void;
}

export function Post({ post, index, onLike, onRepost, onComment, onShare }: PostProps) {
  const [commentText, setCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const { getComments } = usePosts();
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="p-4 border-b border-gray-800 hover:bg-gray-800 transition-colors cursor-pointer"
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <Link to={`/profile/${post.author.id}`} className="flex-shrink-0">
          <img 
            src={post.author.avatar} 
            alt={post.author.name} 
            className="w-12 h-12 rounded-full object-cover bg-gray-800 hover:opacity-80 transition-opacity shadow-sm"
          />
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
            </div>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="text-gray-400 hover:text-brand transition-colors">
              <MoreHorizontal size={20} />
            </motion.button>
          </div>

          {/* Content */}
          <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap text-gray-100">
            {post.content}
          </p>

          {/* RENDER ATTACHED IMAGE */}
          {post.image && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-gray-800">
              <img src={post.image} alt="Post attachment" className="w-full h-auto max-h-[500px] object-cover" />
            </div>
          )}

          {/* RENDER TAGGED LOCATION */}
          {post.location && (
            <div className="flex items-center gap-1 mt-3 text-brand font-medium text-sm">
              <MapPin size={16} />
              <span>{post.location}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between mt-4 text-gray-500 max-w-md">
            <ActionIcon 
              icon={MessageCircle} count={post.comments} hoverColor="hover:text-blue-500" hoverBg="group-hover:bg-blue-500/10" activeBg="bg-blue-500/10" isActive={showCommentInput} activeColor="text-blue-500" onClick={() => setShowCommentInput((prev) => !prev)} 
            />
            <ActionIcon 
              icon={Repeat} count={post.reposts} hoverColor="hover:text-green-500" hoverBg="group-hover:bg-green-500/10" activeBg="bg-green-500/10" isActive={post.isReposted ?? false} activeColor="text-green-500" onClick={onRepost} 
            />
            <ActionIcon 
              icon={Heart} count={post.likes} hoverColor="hover:text-pink-500" hoverBg="group-hover:bg-pink-500/10" activeBg="bg-pink-500/10" isActive={post.isLiked ?? false} activeColor="text-pink-500" fillIcon={post.isLiked ?? false} onClick={onLike} 
            />
            <ActionIcon 
              icon={Share} hoverColor="hover:text-brand" hoverBg="group-hover:bg-brand/10" activeBg="bg-brand/10" isActive={false} activeColor="text-brand" onClick={onShare} 
            />
          </div>

          <AnimatePresence>
            {showCommentInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {/* Comments List */}
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

                {/* PREMIUM AUTO-EXPANDING COMMENT INPUT */}
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
                    className={`px-5 py-2.5 rounded-full text-sm font-bold shadow-md transition-all h-fit mb-[2px] ${
                      commentText.trim() ? 'bg-brand text-brand-contrast hover:opacity-90' : 'bg-gray-800 text-gray-500 cursor-not-allowed'
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
      className={`flex items-center gap-1.5 group transition-colors duration-300 ${hoverColor} ${isActive ? activeColor : ''}`}
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
              {count > 0 ? count : ''}
            </motion.span>
          </AnimatePresence>
        </div>
      )}
    </motion.button>
  );
}