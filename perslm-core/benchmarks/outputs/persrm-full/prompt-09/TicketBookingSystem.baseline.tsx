import React from 'react';

interface TicketBookingSystemProps {
  className?: string;
  children?: React.ReactNode;
}

export function TicketBookingSystem({ className = '', children }: TicketBookingSystemProps) {
  return (
    <div className={className}>
      <h2>TicketBookingSystem</h2>
      {children}
    </div>
  );
}
