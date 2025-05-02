import React from 'react';

interface DataDashboardProps {
  className?: string;
  children?: React.ReactNode;
}

export function DataDashboard({ className = '', children }: DataDashboardProps) {
  return (
    <div className={className}>
      <h2>DataDashboard</h2>
      {children}
    </div>
  );
}
