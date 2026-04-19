// src/pages/Placeholder.tsx
import { motion } from 'framer-motion';

export function Placeholder({ title }: { title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="p-8 text-center"
    >
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <p className="text-gray-500">This page is under construction. 🛠️</p>
    </motion.div>
  );
}