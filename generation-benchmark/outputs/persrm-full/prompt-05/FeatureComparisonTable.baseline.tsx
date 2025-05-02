import React from 'react';

interface FeatureComparisonTableProps {
  className?: string;
  children?: React.ReactNode;
}

export function FeatureComparisonTable({ className = '', children }: FeatureComparisonTableProps) {
  return (
    <div className={className}>
      <h2>FeatureComparisonTable</h2>
      {children}
    </div>
  );
}
