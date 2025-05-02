import React from 'react';
import { motion } from 'framer-motion';

interface FeatureComparisonTableProps {
  className?: string;
  children?: React.ReactNode;
}

export function FeatureComparisonTable({ className = '', children }: FeatureComparisonTableProps) {
  return (
    <motion.div className={`${className} p-4 rounded-md w-full md:max-w-2xl mx-auto`} role="region" aria-labelledby="component-heading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}>
      <h2 id="component-heading">FeatureComparisonTable</h2>
      {children}
    </motion.div>
  );
}
