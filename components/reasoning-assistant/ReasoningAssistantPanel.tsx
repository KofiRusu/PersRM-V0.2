import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReasoningAssistant } from './ReasoningAssistantProvider';
import { useABTesting, AnimationVariant } from './ABTestingProvider';
import { autoAdaptationService } from '@/app/common/auto-adaptation';
import { cn } from '@/lib/utils';
import { Resizable } from 're-resizable';
import ReasoningAssistantContent from './ReasoningAssistantContent';

interface ReasoningAssistantPanelProps {
  children?: React.ReactNode;
  className?: string;
  // If set, this will override the A/B test variant
  forcedAnimationVariant?: AnimationVariant;
  // Enable auto-adaptation
  enableAutoAdaptation?: boolean;
  // Initial panel size (overrides auto-adaptation)
  initialSize?: { width: number; height: string };
}

export const ReasoningAssistantPanel: React.FC<ReasoningAssistantPanelProps> = ({
  children,
  className,
  forcedAnimationVariant,
  enableAutoAdaptation = true,
  initialSize,
}) => {
  const { isOpen } = useReasoningAssistant();
  const { animationVariant, recordEvent } = useABTesting();

  // Use either forced variant or A/B test variant
  const activeVariant = forcedAnimationVariant || animationVariant;
  
  // Get the optimal panel size from auto-adaptation service or use initialSize
  const optimalSize = enableAutoAdaptation
    ? autoAdaptationService.getOptimalPanelSize()
    : { width: 320, height: '100%' };
  
  // Set initial panel size
  const [panelSize, setPanelSize] = useState(initialSize || optimalSize);
  
  // Update panel size when optimal size changes
  useEffect(() => {
    if (enableAutoAdaptation && !initialSize) {
      setPanelSize(autoAdaptationService.getOptimalPanelSize());
    }
  }, [enableAutoAdaptation, initialSize]);
  
  // Track panel visibility changes
  useEffect(() => {
    if (isOpen) {
      // Log that the panel was opened with the current animation variant
      recordEvent('panel-opened', {
        animationVariant: activeVariant,
      });
      
      if (enableAutoAdaptation) {
        autoAdaptationService.trackFeatureUsage('animation-variant', activeVariant);
      }
    }
  }, [isOpen, activeVariant, recordEvent, enableAutoAdaptation]);

  // Animation variants based on the selected animation type
  const variants = {
    slide: {
      initial: { x: '100%', opacity: 0 },
      animate: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
      exit: { x: '100%', opacity: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    },
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.3 } },
      exit: { opacity: 0, transition: { duration: 0.2 } },
    },
    scale: {
      initial: { scale: 0.8, opacity: 0 },
      animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 25 } },
      exit: { scale: 0.8, opacity: 0, transition: { duration: 0.2 } },
    },
  };

  const selectedVariant = variants[activeVariant];

  // Handle user interactions with the panel
  const handleInteraction = () => {
    recordEvent('panel-interaction', {
      animationVariant: activeVariant,
    });
    
    if (enableAutoAdaptation) {
      autoAdaptationService.trackFeatureUsage('panel-size', panelSize);
    }
  };
  
  // Handle resize events
  const handleResize = (e: MouseEvent | TouchEvent, direction: string, ref: HTMLElement, delta: { width: number; height: number }) => {
    const newSize = {
      width: panelSize.width + delta.width,
      height: panelSize.height,
    };
    
    setPanelSize(newSize);
    
    // Track resize event
    if (enableAutoAdaptation) {
      // Track in retention service for adaptation rules
      autoAdaptationService.trackFeatureUsage('panel-size', newSize);
      recordEvent('panel-resize', {
        size: newSize,
        direction,
      });
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <Resizable
          size={{ 
            width: panelSize.width, 
            height: panelSize.height,
          }}
          minWidth={320}
          maxWidth={800}
          enable={{
            top: false,
            right: false,
            bottom: false,
            left: true,
            topRight: false,
            bottomRight: false,
            bottomLeft: false,
            topLeft: false,
          }}
          onResizeStop={handleResize}
          className="fixed right-0 top-0 bottom-0 z-50"
        >
          <motion.div
            className={cn(
              "h-full bg-background border-l border-border shadow-lg p-4",
              className
            )}
            initial={selectedVariant.initial}
            animate={selectedVariant.animate}
            exit={selectedVariant.exit}
            aria-hidden={!isOpen}
            onMouseEnter={() => recordEvent('panel-hover')}
            onClick={handleInteraction}
            data-testid={`reasoning-panel-${activeVariant}`}
            data-variant={activeVariant}
          >
            <div className="h-full overflow-auto">
              {children ? children : <ReasoningAssistantContent />}
            </div>
          </motion.div>
        </Resizable>
      )}
    </AnimatePresence>
  );
};

export default ReasoningAssistantPanel; 