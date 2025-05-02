import React from 'react';

interface TestimonialCarouselProps {
  className?: string;
  children?: React.ReactNode;
}

export function TestimonialCarousel({ className = '', children }: TestimonialCarouselProps) {
  return (
    <div className={className}>
      <h2>TestimonialCarousel</h2>
      {children}
    </div>
  );
}
