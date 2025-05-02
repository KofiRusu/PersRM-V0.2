import React from 'react';
import { motion } from 'framer-motion';

interface EnhancedCardProps {
  className?: string;
  title?: string;
  children: React.ReactNode;
}

export function EnhancedCard({ className = '', title, children }: EnhancedCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }} role="region" aria-labelledby={title ? "card-title" : undefined} className={"card p-4 md:p-6 shadow-sm hover:shadow-md rounded-lg transition-all duration-200 " + className}>
      {title && <h2 id="card-title" className="card-title text-xl md:text-2xl mb-3">{title}</h2>}
      <div className="card-content space-y-3">
        {children}
      </div>
    </motion.section>
  );
}
