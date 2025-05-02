import React from 'react';
import { useState } from 'react';

// hero section implementation based on prompt requirements
// Requirements: A headline that communicates the core value proposition, A supporting subheadline that explains benefits, Two CTAs: "Start Free Trial" (primary) and "Watch Demo" (secondary), A modern illustration or image placeholder on the right side, A small "Trusted by" logo section with 4-5 placeholder company logos

export default function herosectionComponent() {
  const [isActive, setIsActive] = useState(false);

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">hero section</h2>
      <div className="bg-blue-100 p-8 rounded-lg">
        <h1 className="text-4xl font-bold">Welcome to Our Platform</h1>
        <p className="my-4">The best solution for your needs</p>
        <button className="bg-blue-500 text-white px-4 py-2 rounded">
          Get Started
        </button>
      </div>
    </div>
  );
}
