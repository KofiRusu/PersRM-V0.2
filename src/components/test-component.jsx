import React, { useState } from 'react';

// Simple button component with some common UX issues 
// This component will be detected by the watcher
const SimpleButton = ({ 
  label = 'Click me', 
  onClick, 
  disabled = false,
  className = '',
  style = {}
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Missing color contrast - will be flagged in analysis
  const buttonStyle = {
    padding: '10px 20px',
    backgroundColor: disabled ? '#cccccc' : (isHovered ? '#0055aa' : '#0066cc'),
    color: '#e5e5e5', // low contrast with background - UX issue
    border: 'none',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.1s', // too fast - UX issue
    fontSize: '13px', // too small - UX issue
    ...style
  };

  return (
    <button
      className={`simple-button ${className}`} 
      style={buttonStyle}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      // Missing aria-label - accessibility issue
    >
      {label}
    </button>
  );
};

// Export the component
export default SimpleButton;
