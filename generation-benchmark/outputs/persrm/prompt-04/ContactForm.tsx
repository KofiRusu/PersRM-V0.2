import React from 'react';

interface ContactFormProps {
  className?: string;
  children?: React.ReactNode;
}

export function ContactForm({ className = '', children }: ContactFormProps) {
  return (
    <div className={className}>
      <h2>ContactForm</h2>
      {children}
    </div>
  );
}
