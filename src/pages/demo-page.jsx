import React, { useState } from 'react';
import SimpleButton from '../components/test-component';

const DemoPage = () => {
  const [clickCount, setClickCount] = useState(0);
  
  const handleClick = () => {
    setClickCount(prev => prev + 1);
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '800px', 
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>PersRM Demo Page</h1>
      <p>This page demonstrates components that will be analyzed by the PersRM watcher.</p>
      
      <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Test Component</h2>
        <p>Click the button below to see it in action:</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
          <SimpleButton 
            label="Primary Button" 
            onClick={handleClick} 
          />
          
          <SimpleButton 
            label="Disabled Button" 
            disabled={true}
          />
          
          <SimpleButton 
            label="Custom Styled Button"
            onClick={handleClick}
            style={{ 
              backgroundColor: '#6200ee', 
              padding: '12px 24px',
              fontSize: '14px'
            }}
          />
        </div>
        
        <p style={{ marginTop: '20px' }}>
          Button clicked: <strong>{clickCount} times</strong>
        </p>
      </div>
      
      <div style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
        <p>
          Note: This component contains intentional UX issues that the PersRM watcher should detect,
          including color contrast problems, small font sizes, and missing accessibility attributes.
        </p>
      </div>
    </div>
  );
};

export default DemoPage; 