import React from 'react';

interface PricingSectionProps {
  className?: string;
  children?: React.ReactNode;
}

export function PricingSection({ className = '', children }: PricingSectionProps) {
  return (
    <div className={className}>
      <h2>PricingSection</h2>
      {children}
    </div>
  );
}
