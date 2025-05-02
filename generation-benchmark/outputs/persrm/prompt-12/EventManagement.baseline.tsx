import React from 'react';

interface EventManagementProps {
  className?: string;
  children?: React.ReactNode;
}

export function EventManagement({ className = '', children }: EventManagementProps) {
  return (
    <div className={className}>
      <h2>EventManagement</h2>
      {children}
    </div>
  );
}
