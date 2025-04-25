import React, { createContext, useContext, useState, useEffect } from 'react';
import { retentionService } from '@/app/common/retention';

// Animation variant options
export type AnimationVariant = 'slide' | 'fade' | 'scale';

interface ABTestingContextType {
  animationVariant: AnimationVariant;
  recordEvent: (eventName: string, metadata?: Record<string, any>) => void;
}

const ABTestingContext = createContext<ABTestingContextType | undefined>(undefined);

export const useABTesting = () => {
  const context = useContext(ABTestingContext);
  if (!context) {
    throw new Error('useABTesting must be used within an ABTestingProvider');
  }
  return context;
};

interface ABTestingProviderProps {
  children: React.ReactNode;
  // If provided, overrides the randomized variant assignment
  forcedVariant?: AnimationVariant;
  // Whether to enable tracking of A/B test events
  enableTracking?: boolean;
  // Test name for logging and persistence
  testName?: string;
}

export const ABTestingProvider: React.FC<ABTestingProviderProps> = ({
  children,
  forcedVariant,
  enableTracking = true,
  testName = 'reasoning-assistant-animation',
}) => {
  const [animationVariant, setAnimationVariant] = useState<AnimationVariant>('slide');
  const [testId, setTestId] = useState<string>('');

  // Initialize the A/B test on component mount
  useEffect(() => {
    // Function to initialize the test
    const initializeTest = () => {
      try {
        // Check if we already have a variant assigned for this test
        const savedTestData = localStorage.getItem(`ab-test-${testName}`);
        
        if (savedTestData) {
          // Use the saved variant if it exists
          const { variant, id } = JSON.parse(savedTestData);
          setAnimationVariant(variant as AnimationVariant);
          setTestId(id);
          
          // Log that we're using a pre-assigned variant
          if (enableTracking) {
            retentionService.trackEvent('ab-test-existing-assignment', {
              testName,
              variant,
              testId: id,
            });
          }
        } else {
          // Otherwise, randomly assign a variant
          let variant: AnimationVariant;
          
          if (forcedVariant) {
            // Use the forced variant if provided
            variant = forcedVariant;
          } else {
            // Randomly select a variant
            const variants: AnimationVariant[] = ['slide', 'fade', 'scale'];
            const randomIndex = Math.floor(Math.random() * variants.length);
            variant = variants[randomIndex];
          }
          
          // Generate a unique test ID
          const id = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
          
          // Save to localStorage for consistency across sessions
          localStorage.setItem(`ab-test-${testName}`, JSON.stringify({ 
            variant, 
            id,
            assignedAt: new Date().toISOString() 
          }));
          
          setAnimationVariant(variant);
          setTestId(id);
          
          // Log the new assignment
          if (enableTracking) {
            retentionService.trackEvent('ab-test-new-assignment', {
              testName,
              variant,
              testId: id,
              forcedAssignment: !!forcedVariant,
            });
          }
        }
      } catch (error) {
        console.error('Error initializing A/B test:', error);
        // Fallback to default variant
        setAnimationVariant('slide');
      }
    };
    
    initializeTest();
  }, [forcedVariant, enableTracking, testName]);
  
  // Function to record A/B test-related events
  const recordEvent = (eventName: string, metadata?: Record<string, any>) => {
    if (!enableTracking) return;
    
    retentionService.trackEvent(`ab-test-${eventName}`, {
      testName,
      variant: animationVariant,
      testId,
      ...metadata,
    });
  };
  
  return (
    <ABTestingContext.Provider value={{ animationVariant, recordEvent }}>
      {children}
    </ABTestingContext.Provider>
  );
};

export default ABTestingProvider; 