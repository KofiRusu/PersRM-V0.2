import { useEffect, useRef, useState, useCallback } from 'react';
import { retentionService } from '@/app/common/retention';

type ActionType = 'open' | 'close' | 'toggle' | 'resize' | 'interaction';
type ValidationResult = 'success' | 'warning' | 'error' | 'pending' | 'none';

interface ValidationOptions {
  enabled?: boolean;
  validateOnMount?: boolean;
  autoFix?: boolean;
  timeout?: number;
}

/**
 * Hook for validating assistant actions
 * This can be used to ensure the assistant behaves correctly after actions
 */
export function useValidationHook(options: ValidationOptions = {}) {
  const {
    enabled = true,
    validateOnMount = false,
    autoFix = false,
    timeout = 5000,
  } = options;

  const [isValidating, setIsValidating] = useState(false);
  const [lastValidationResult, setLastValidationResult] = useState<ValidationResult>('none');
  const [lastValidationError, setLastValidationError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending validations
  const clearPendingValidation = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Run validation after action
  const validateAction = useCallback(async (action: ActionType, metadata?: Record<string, any>) => {
    if (!enabled) return;

    try {
      setIsValidating(true);
      setLastValidationResult('pending');
      setLastValidationError(null);

      // Log validation start
      retentionService.trackEvent('validation-started', {
        action,
        metadata,
        timestamp: Date.now(),
      });

      // Run validation checks appropriate for the action
      // For now, we're just simulating validation with a timeout
      // In a real implementation, you would perform actual validation checks
      clearPendingValidation();

      timeoutRef.current = setTimeout(() => {
        // Simulate success (in a real implementation, you'd do actual validation)
        setLastValidationResult('success');
        setIsValidating(false);

        // Log validation success
        retentionService.trackEvent('validation-completed', {
          action,
          result: 'success',
          metadata,
          duration: timeout,
        });
      }, timeout);
    } catch (error) {
      const errorMessage = (error as Error).message;
      setLastValidationResult('error');
      setLastValidationError(errorMessage);
      setIsValidating(false);

      // Log validation error
      retentionService.trackEvent('validation-failed', {
        action,
        error: errorMessage,
        metadata,
      });

      // If autoFix is enabled, attempt to recover
      if (autoFix) {
        try {
          // Apply auto-fix (in a real implementation, this would depend on the error)
          retentionService.trackEvent('validation-autofix-applied', {
            action,
            error: errorMessage,
            metadata,
          });
        } catch (fixError) {
          retentionService.trackEvent('validation-autofix-failed', {
            action,
            error: errorMessage,
            fixError: (fixError as Error).message,
            metadata,
          });
        }
      }
    }
  }, [enabled, timeout, clearPendingValidation, autoFix]);

  // Run validation on mount if requested
  useEffect(() => {
    if (enabled && validateOnMount) {
      validateAction('open', { source: 'mount' });
    }

    // Cleanup
    return () => {
      clearPendingValidation();
    };
  }, [enabled, validateOnMount, validateAction, clearPendingValidation]);

  return {
    validateAction,
    isValidating,
    lastValidationResult,
    lastValidationError,
    clearPendingValidation,
  };
}

export default useValidationHook; 