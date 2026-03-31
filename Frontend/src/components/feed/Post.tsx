import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { MessageCircle, Repeat, Heart, Share, MoreHorizontal } from 'lucide-react';
import { usePosts, type CommentData } from '../../context/PostContext';

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
}

interface PostProps {
  post: PostData;
  index: number;
  onLike: () => void;
  onRepost: () => void;
  onComment: (comment: string) => void;
  onShare: () => void;
}

import { Link } from 'react-router-dom';

export function Post({ post, index, onLike, onRepost, onComment, onShare }: PostProps) {
  const [commentText, setCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const { getComments } = usePosts();
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

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

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="p-4 border-b border-gray-800 hover:bg-gray-900/50 transition-colors"
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <Link to={`/profile/${post.author.id}`} className="flex-shrink-0">
          <img 
            src={post.author.avatar} 
            alt={post.author.name} 
            className="w-12 h-12 rounded-full object-cover bg-gray-800 hover:opacity-80 transition-opacity"
          />
        </Link>

        <div className="flex-1">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <Link to={`/profile/${post.author.id}`} className="text-white font-bold hover:underline">
                {post.author.name}
              </Link>
              <span className="text-gray-300 ml-2">@{post.author.handle}</span>
              <span className="text-gray-300 mx-1">·</span>
              <span className="text-gray-300 hover:underline">{post.timestamp}</span>
            </div>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="text-gray-400 hover:text-brand">
              <MoreHorizontal size={20} />
            </motion.button>
          </div>

          {/* Content */}
          <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap text-gray-100">
            {post.content}
          </p>

          {/* Action Buttons */}
          <div className="flex justify-between mt-4 text-gray-400 max-w-md">
            <ActionIcon 
              icon={MessageCircle} 
              count={post.comments} 
              hoverColor="text-blue-300" 
              hoverBg="bg-blue-500/10" 
              isActive={showCommentInput}
              activeColor="text-blue-300"
              onClick={() => setShowCommentInput((prev) => !prev)}
            />
            
            <ActionIcon 
              icon={Repeat} 
              count={post.reposts} 
              hoverColor="text-green-300" 
              hoverBg="bg-green-500/10" 
              isActive={post.isReposted ?? false}
              activeColor="text-green-300"
              onClick={onRepost}
            />
            
            <ActionIcon 
              icon={Heart} 
              count={post.likes} 
              hoverColor="text-pink-300" 
              hoverBg="bg-pink-500/10" 
              isActive={post.isLiked ?? false}
              activeColor="text-pink-300"
              onClick={onLike}
            />
            
            <ActionIcon 
              icon={Share} 
              hoverColor="text-brand" 
              hoverBg="bg-brand/10" 
              isActive={false}
              activeColor="text-brand"
              onClick={onShare}
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
                            <Link to={`/profile/${comment.author.id}`} className="text-white font-bold text-sm hover:underline">
                              {comment.author.name}
                            </Link>
                            <span className="text-gray-500 text-xs">@{comment.author.handle}</span>
                          </div>
                          <p className="text-gray-200 text-sm">{comment.content}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm italic">No comments yet. Be the first!</p>
                  )}
                </div>

                {/* Comment Input */}
                <div className="mt-4 flex gap-2">
                  <textarea
                    rows={1}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-800 rounded-lg p-2 text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand text-sm"
                    placeholder="Write a comment..."
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!commentText.trim()) return;
                      await onComment(commentText.trim());
                      setCommentText('');
                      // Refresh comments
                      const data = await getComments(post.id);
                      setComments(data);
                    }}
                    className="bg-brand text-white px-4 py-1 rounded-full hover:bg-brand/80 text-sm font-bold"
                  >
                    Post
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  );
}

// Updated Helper Component
interface ActionIconProps {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  count?: number;
  hoverColor: string;
  hoverBg: string;
  isActive?: boolean;
  activeColor?: string;
  onClick?: () => void;
}

function ActionIcon({ icon: Icon, count, hoverColor, hoverBg, isActive = false, activeColor = '', onClick }: ActionIconProps) {
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation(); // Prevents clicking the post when clicking the button
        if (onClick) onClick();
      }}
      className={`flex items-center gap-2 group transition-colors hover:${hoverColor} ${isActive ? activeColor : ''}`}
      whileTap={{ scale: 0.8 }}
    >
      <div className={`p-2 rounded-full transition-colors group-hover:${hoverBg} ${isActive ? hoverBg : ''}`}>
        <Icon className={`w-[18px] h-[18px] ${isActive ? activeColor : ''}`} />
      </div>
      {count !== undefined && <span className="text-sm">{count}</span>}
    </motion.button>
  );
}