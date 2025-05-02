import React from 'react';
import { motion } from 'framer-motion';

interface EnhancedButtonProps {
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function EnhancedButton({ className = '', onClick, children, disabled = false, type = 'button' }: EnhancedButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.03 }}
      type={type}
      className={`${className} transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500`}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
    >
      <span className="whitespace-nowrap">{children}</span>
    </motion.button>
  );
}
