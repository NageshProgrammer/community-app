// src/pages/Home.tsx
import { motion } from 'framer-motion';
import { Feed } from '../components/feed/Feed';

export function Home() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-transparent py-6 sm:px-4 lg:px-6 w-full"
    >
      {/* Added the constraining wrapper to match Notifications/Messages */}
      <div className="max-w-3xl mx-auto border border-gray-800 shadow-2xl bg-transparent rounded-4xl ">
        <Feed />
      </div>
    </motion.div>
  );
}