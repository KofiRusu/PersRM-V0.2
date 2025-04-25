import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { retentionService } from '@/app/common/retention';
import { useValidationHook } from './useValidationHook';

interface ReasoningAssistantContextType {
  isOpen: boolean;
  toggleAssistant: (source?: 'button' | 'keyboard' | 'api' | 'auto') => void;
  openAssistant: (source?: 'button' | 'keyboard' | 'api' | 'auto') => void;
  closeAssistant: (source?: 'button' | 'keyboard' | 'api' | 'auto') => void;
  isValidating: boolean;
  validationResult: 'success' | 'warning' | 'error' | 'pending' | 'none';
}

const ReasoningAssistantContext = createContext<ReasoningAssistantContextType | undefined>(undefined);

export const useReasoningAssistant = () => {
  const context = useContext(ReasoningAssistantContext);
  if (!context) {
    throw new Error('useReasoningAssistant must be used within a ReasoningAssistantProvider');
  }
  return context;
};

interface ReasoningAssistantProviderProps {
  children: React.ReactNode;
  keyboardShortcut?: string;
  enableLogging?: boolean;
  enableValidation?: boolean;
}

export const ReasoningAssistantProvider: React.FC<ReasoningAssistantProviderProps> = ({ 
  children,
  keyboardShortcut = 'k',
  enableLogging = true,
  enableValidation = true,
}) => {
  // State to track if the reasoning assistant is open
  const [isOpen, setIsOpen] = useState<boolean>(false);
  // Track the last source that triggered a state change
  const lastActionSourceRef = useRef<'button' | 'keyboard' | 'api' | 'auto'>('button');

  // Initialize validation hook
  const { 
    validateAction, 
    isValidating, 
    lastValidationResult, 
    lastValidationError 
  } = useValidationHook({
    enabled: enableValidation,
    validateOnMount: false,
    autoFix: true,
  });

  // Configure RetentionService on component mount
  useEffect(() => {
    if (enableLogging) {
      // Configure with the API endpoint path
      retentionService.configure('/api/logging/events');
    }
  }, [enableLogging]);

  // Clean up RetentionService on unmount
  useEffect(() => {
    return () => {
      // Attempt to flush any pending events before unmounting
      if (enableLogging) {
        retentionService.flush().catch(console.error);
      }
    };
  }, [enableLogging]);

  // Load saved state from localStorage on component mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem('reasoning-assistant-state');
      if (savedState) {
        const { isOpen: savedIsOpen } = JSON.parse(savedState);
        setIsOpen(savedIsOpen);
      }
    } catch (error) {
      console.error('Error loading reasoning assistant state:', error);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('reasoning-assistant-state', JSON.stringify({ isOpen }));
    } catch (error) {
      console.error('Error saving reasoning assistant state:', error);
    }
  }, [isOpen]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for ⌘+K (Mac) or Ctrl+K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === keyboardShortcut) {
        event.preventDefault(); // Prevent default browser behavior
        toggleAssistant('keyboard');
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Clean up
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [keyboardShortcut]);

  // Log events when assistant state changes
  useEffect(() => {
    // Skip logging on initial render or if logging is disabled
    const isInitialRender = useRef(true);
    if (isInitialRender.current || !enableLogging) {
      isInitialRender.current = false;
      return;
    }

    // Log the appropriate event based on isOpen state
    if (isOpen) {
      retentionService.trackAssistantEvent('open', lastActionSourceRef.current, {
        triggerMethod: lastActionSourceRef.current,
      });
      
      // Run validation after opening
      if (enableValidation) {
        validateAction('open', { source: lastActionSourceRef.current });
      }
    } else {
      retentionService.trackAssistantEvent('close', lastActionSourceRef.current, {
        triggerMethod: lastActionSourceRef.current,
      });
      
      // Run validation after closing
      if (enableValidation) {
        validateAction('close', { source: lastActionSourceRef.current });
      }
    }
  }, [isOpen, enableLogging, enableValidation, validateAction]);

  // Toggle the assistant visibility
  const toggleAssistant = (source: 'button' | 'keyboard' | 'api' | 'auto' = 'button') => {
    lastActionSourceRef.current = source;
    setIsOpen(prev => !prev);
    
    // Run validation after toggle
    if (enableValidation) {
      validateAction('toggle', { source });
    }
  };

  // Explicitly open the assistant
  const openAssistant = (source: 'button' | 'keyboard' | 'api' | 'auto' = 'button') => {
    if (!isOpen) {
      lastActionSourceRef.current = source;
      setIsOpen(true);
      
      // Run validation after opening
      if (enableValidation) {
        validateAction('open', { source });
      }
    }
  };

  // Explicitly close the assistant
  const closeAssistant = (source: 'button' | 'keyboard' | 'api' | 'auto' = 'button') => {
    if (isOpen) {
      lastActionSourceRef.current = source;
      setIsOpen(false);
      
      // Run validation after closing
      if (enableValidation) {
        validateAction('close', { source });
      }
    }
  };

  // The context value we're providing
  const contextValue: ReasoningAssistantContextType = {
    isOpen,
    toggleAssistant,
    openAssistant,
    closeAssistant,
    isValidating,
    validationResult: lastValidationResult,
  };

  return (
    <ReasoningAssistantContext.Provider value={contextValue}>
      {children}
    </ReasoningAssistantContext.Provider>
  );
};

export default ReasoningAssistantProvider; 