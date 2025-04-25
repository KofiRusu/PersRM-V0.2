import React, { useEffect } from 'react';
import { ReasoningAssistantProvider } from './ReasoningAssistantProvider';
import { ABTestingProvider, AnimationVariant } from './ABTestingProvider';
import { autoAdaptationService } from '@/app/common/auto-adaptation';
import { executionRecoveryService } from '@/app/common/execution-recovery';

interface ReasoningAssistantRootProps {
  children: React.ReactNode;
  keyboardShortcut?: string;
  enableLogging?: boolean;
  forcedAnimationVariant?: AnimationVariant;
  enableABTesting?: boolean;
  enableAutoAdaptation?: boolean;
  enableRecovery?: boolean;
  testName?: string;
}

export const ReasoningAssistantRoot: React.FC<ReasoningAssistantRootProps> = ({
  children,
  keyboardShortcut,
  enableLogging = true,
  forcedAnimationVariant,
  enableABTesting = true,
  enableAutoAdaptation = true,
  enableRecovery = true,
  testName,
}) => {
  // Initialize the auto-adaptation service
  useEffect(() => {
    if (enableAutoAdaptation) {
      autoAdaptationService.initialize().catch(console.error);
    }
  }, [enableAutoAdaptation]);

  // Initialize the execution recovery service
  useEffect(() => {
    if (enableRecovery) {
      executionRecoveryService.initialize().catch(console.error);
    }
    
    return () => {
      if (enableRecovery) {
        executionRecoveryService.dispose();
      }
    };
  }, [enableRecovery]);

  // Run auto-adaptation analysis periodically
  useEffect(() => {
    if (!enableAutoAdaptation) return;

    // Run initial analysis
    autoAdaptationService.analyzeAndAdapt().catch(console.error);

    // Set up interval for periodic analysis (every 5 minutes)
    const intervalId = setInterval(() => {
      autoAdaptationService.analyzeAndAdapt().catch(console.error);
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [enableAutoAdaptation]);

  // Get adapted keyboard shortcut
  const adaptedKeyboardShortcut = enableAutoAdaptation
    ? autoAdaptationService.getPreferredKeyboardShortcut()
    : keyboardShortcut || 'k';

  // Get adapted animation variant
  const adaptedAnimationVariant = enableAutoAdaptation && !forcedAnimationVariant
    ? autoAdaptationService.getBestAnimationVariant()
    : forcedAnimationVariant;

  return (
    <ReasoningAssistantProvider 
      keyboardShortcut={adaptedKeyboardShortcut}
      enableLogging={enableLogging}
    >
      <ABTestingProvider
        forcedVariant={adaptedAnimationVariant}
        enableTracking={enableLogging && enableABTesting}
        testName={testName}
      >
        {children}
      </ABTestingProvider>
    </ReasoningAssistantProvider>
  );
};

export default ReasoningAssistantRoot; 