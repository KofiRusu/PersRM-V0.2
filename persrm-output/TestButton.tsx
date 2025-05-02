import React from 'react';

interface TestButtonProps {
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function TestButton({ className = '', onClick, children, disabled = false, type = 'button' }: TestButtonProps) {
  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
