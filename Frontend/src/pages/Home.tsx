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
    >
      <Feed />
    </motion.div>
  );
}