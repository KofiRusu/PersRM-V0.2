import React from 'react';

interface HeroSectionProps {
  className?: string;
  children?: React.ReactNode;
}

export function HeroSection({ className = '', children }: HeroSectionProps) {
  return (
    <div className={className}>
      <h2>HeroSection</h2>
      {children}
    </div>
  );
}
