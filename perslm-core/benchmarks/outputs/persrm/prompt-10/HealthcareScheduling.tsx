import React from 'react';

interface HealthcareSchedulingProps {
  className?: string;
  children?: React.ReactNode;
}

export function HealthcareScheduling({ className = '', children }: HealthcareSchedulingProps) {
  return (
    <div className={className}>
      <h2>HealthcareScheduling</h2>
      {children}
    </div>
  );
}
