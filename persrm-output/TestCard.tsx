import React from 'react';

interface TestCardProps {
  className?: string;
  title?: string;
  children: React.ReactNode;
}

export function TestCard({ className = '', title, children }: TestCardProps) {
  return (
    <section className={"card " + className}>
      {title && <h2 className="card-title">{title}</h2>}
      <div className="card-content">
        {children}
      </div>
    </section>
  );
}
