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
    <div className="max-w-3xl">
      {!searchQuery && <CreatePost onPost={addPost} userId={user?.id || ''} />}
      
      {searchQuery && (
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <p className="text-gray-500">Showing results for <span className="text-white font-bold">"{searchQuery}"</span></p>
          <button 
            onClick={() => setSearchQuery('')}
            className="text-brand text-sm font-bold hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      <div>
        {filteredPosts.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="bg-gray-800 p-6 rounded-full mb-4">
              <SearchX className="w-10 h-10 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-white">No matches found</h3>
            <p className="text-gray-500 mt-1 text-sm">
              We couldn't find any posts matching your search.
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