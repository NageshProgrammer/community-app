// src/components/feed/Feed.tsx
import { AnimatePresence, motion } from 'framer-motion';
import { CreatePost } from './CreatePost';
import { Post } from './Post';
import { usePosts } from '../../context/PostContext';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { SearchX, ArrowLeft } from 'lucide-react';
import { useSearchParams } from 'react-router-dom'; // NEW: To read the URL!

export function Feed() {
  const { posts, addPost, toggleLike, toggleRepost, addComment, sharePost, deletePost } = usePosts();
  const { user } = useAuth();
  const { searchQuery, setSearchQuery } = useSocial();
  
  // NEW: Read the ?shared= ID from the URL
  const [searchParams, setSearchParams] = useSearchParams();
  const sharedPostId = searchParams.get('shared');

  // NEW: Filter logic that handles both "Search" and "Shared Post" modes
  let displayPosts = posts;
  
  if (sharedPostId) {
    // If a shared link is used, ONLY show that specific post
    displayPosts = posts.filter(post => post.id === sharedPostId);
  } else if (searchQuery) {
    // Otherwise, handle normal searching
    displayPosts = posts.filter(post => 
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.author.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.author.handle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // NEW: Function to clear the shared post from the URL
  const clearSharedPost = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('shared');
    setSearchParams(newParams);
  };

  return (
    <div className="max-w-3xl mx-auto rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden shadow-xl px-3">
      
      {/* If we are NOT viewing a shared post and NOT searching, show the Create Post box */}
      {!searchQuery && !sharedPostId && (
        <div className="border-b border-gray-800 p-4">
          <CreatePost onPost={addPost} userId={user?.id || ''} />
        </div>
      )}

      {/* HEADER: Viewing a Shared Post */}
      {sharedPostId && (
        <div className="px-4 py-4 border-b border-gray-800 flex items-center gap-3 bg-brand/5">
          <button 
            onClick={clearSharedPost}
            className="p-2 hover:bg-brand/20 text-brand rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">Shared Post</h2>
            <p className="text-gray-500 text-sm">Viewing a single post</p>
          </div>
        </div>
      )}
      
      {/* HEADER: Search Results */}
      {searchQuery && !sharedPostId && (
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-transparent">
          <p className="text-gray-500">
            Showing results for <span className="text-white font-bold">"{searchQuery}"</span>
          </p>
          <button 
            onClick={() => setSearchQuery('')}
            className="px-4 py-1.5 bg-brand text-brand-contrast text-sm font-bold rounded-full hover:opacity-90 transition-opacity shadow-sm"
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex flex-col [&>article:last-child]:border-b-0">
        {displayPosts.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center px-4"
          >
            <div className="bg-gray-800 p-6 rounded-full mb-4 shadow-inner border border-gray-800/50">
              <SearchX className="w-10 h-10 text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {sharedPostId ? "Post not found" : "No matches found"}
            </h3>
            <p className="text-gray-500 text-sm max-w-sm">
              {sharedPostId 
                ? "This post may have been deleted or does not exist." 
                : "We couldn't find any posts matching your search. Try using different keywords or clearing your search."}
            </p>
            
            {sharedPostId && (
              <button 
                onClick={clearSharedPost}
                className="mt-6 px-6 py-2 bg-gray-800 text-white font-bold rounded-full hover:bg-gray-700 transition-colors"
              >
                Back to Feed
              </button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {displayPosts.map((post, index) => (
              <Post
                key={post.id}
                post={post}
                index={index}
                onLike={() => toggleLike(post.id)}
                onRepost={() => toggleRepost(post.id)}
                onComment={(comment) => addComment(post.id, comment)}
                onShare={() => sharePost(post.id)}
                onDelete={() => deletePost(post.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}