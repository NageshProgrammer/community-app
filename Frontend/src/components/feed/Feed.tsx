import { AnimatePresence, motion } from 'framer-motion';
import { CreatePost } from './CreatePost';
import { Post } from './Post';
import { usePosts } from '../../context/PostContext';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { SearchX } from 'lucide-react';

export function Feed() {
  const { posts, addPost, toggleLike, toggleRepost, addComment, sharePost } = usePosts();
  const { user } = useAuth();
  const { searchQuery, setSearchQuery } = useSocial();

  const filteredPosts = posts.filter(post => 
    post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.author.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.author.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    // Upgraded the container to use the sleek glass panel styling with shadow-xl
    <div className="max-w-3xl mx-auto rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden shadow-xl px-3">
      
      {!searchQuery && (
        <div className="border-b border-gray-800 p-4">
          <CreatePost onPost={addPost} userId={user?.id || ''} />
        </div>
      )}
      
      {searchQuery && (
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-transparent">
          <p className="text-gray-500">
            Showing results for <span className="text-white font-bold">"{searchQuery}"</span>
          </p>
          <button 
            onClick={() => setSearchQuery('')}
            // Upgraded to a theme-aware pill button instead of just text
            className="px-4 py-1.5 bg-brand text-brand-contrast text-sm font-bold rounded-full hover:opacity-90 transition-opacity shadow-sm"
          >
            Clear
          </button>
        </div>
      )}

      {/* FIXED: Added [&>article:last-child]:border-b-0 to perfectly collapse the bottom border gap! */}
      <div className="flex flex-col [&>article:last-child]:border-b-0">
        {filteredPosts.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center px-4"
          >
            {/* Uses bg-gray-800 to trigger the secondary glass effect for the icon background */}
            <div className="bg-gray-800 p-6 rounded-full mb-4 shadow-inner border border-gray-800/50">
              <SearchX className="w-10 h-10 text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No matches found</h3>
            <p className="text-gray-500 text-sm max-w-sm">
              We couldn't find any posts matching your search. Try using different keywords or clearing your search.
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredPosts.map((post, index) => (
              <Post
                key={post.id}
                post={post}
                index={index}
                onLike={() => toggleLike(post.id)}
                onRepost={() => toggleRepost(post.id)}
                onComment={(comment) => addComment(post.id, comment)}
                onShare={() => sharePost(post.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}