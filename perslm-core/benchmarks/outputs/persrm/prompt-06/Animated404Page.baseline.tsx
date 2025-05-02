import React from 'react';

interface Animated404PageProps {
  className?: string;
  children?: React.ReactNode;
}

export function Animated404Page({ className = '', children }: Animated404PageProps) {
  return (
    <div className={className}>
      <h2>Animated404Page</h2>
      {children}
    </div>
  );
}
