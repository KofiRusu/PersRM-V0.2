import React from 'react';

interface PricingCalculatorProps {
  className?: string;
  children?: React.ReactNode;
}

export function PricingCalculator({ className = '', children }: PricingCalculatorProps) {
  return (
    <div className={className}>
      <h2>PricingCalculator</h2>
      {children}
    </div>
  );
}
