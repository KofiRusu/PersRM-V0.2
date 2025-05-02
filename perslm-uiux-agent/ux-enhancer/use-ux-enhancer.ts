import { useState, useEffect } from 'react';
import { EnhancementSummary, UXEnhancerEvents } from './types';

interface UseUXEnhancerOptions {
  onUpdate?: (summary: EnhancementSummary) => void;
  onError?: (error: Error) => void;
  onPhaseComplete?: (phaseType: string, result: any) => void;
}

interface UXEnhancerEngine {
  addEventListener: (event: string, callback: (data: any) => void) => void;
  removeEventListener: (event: string, callback: (data: any) => void) => void;
  getLatestSummary: () => EnhancementSummary | null;
}

declare global {
  interface Window {
    UXEnhancerEngine?: UXEnhancerEngine;
  }
}

/**
 * Custom hook for interacting with the UX Enhancer engine
 * Handles event subscriptions and provides access to the latest summary
 */
export function useUXEnhancer(options: UseUXEnhancerOptions = {}) {
  const [summary, setSummary] = useState<EnhancementSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const engine = window.UXEnhancerEngine;
    
    if (!engine) {
      const engineError = new Error('UX Enhancer engine not found');
      setError(engineError);
      if (options.onError) options.onError(engineError);
      return;
    }
    
    // Get initial summary if available
    const initialSummary = engine.getLatestSummary();
    if (initialSummary) {
      setSummary(initialSummary);
      if (options.onUpdate) options.onUpdate(initialSummary);
    }
    
    // Define event handlers
    const handleUpdate = (data: EnhancementSummary) => {
      setSummary(data);
      setLoading(false);
      if (options.onUpdate) options.onUpdate(data);
    };
    
    const handleError = (err: Error) => {
      setError(err);
      setLoading(false);
      if (options.onError) options.onError(err);
    };
    
    const handlePhaseComplete = (data: { phaseType: string; result: any }) => {
      if (options.onPhaseComplete) {
        options.onPhaseComplete(data.phaseType, data.result);
      }
    };
    
    const handleAnalysisStart = () => {
      setLoading(true);
      setError(null);
    };
    
    // Subscribe to events
    engine.addEventListener(UXEnhancerEvents.UPDATE, handleUpdate);
    engine.addEventListener(UXEnhancerEvents.ERROR, handleError);
    engine.addEventListener(UXEnhancerEvents.PHASE_COMPLETE, handlePhaseComplete);
    engine.addEventListener(UXEnhancerEvents.ANALYSIS_START, handleAnalysisStart);
    
    // Cleanup function
    return () => {
      engine.removeEventListener(UXEnhancerEvents.UPDATE, handleUpdate);
      engine.removeEventListener(UXEnhancerEvents.ERROR, handleError);
      engine.removeEventListener(UXEnhancerEvents.PHASE_COMPLETE, handlePhaseComplete);
      engine.removeEventListener(UXEnhancerEvents.ANALYSIS_START, handleAnalysisStart);
    };
  }, [options.onError, options.onPhaseComplete, options.onUpdate]);
  
  return {
    summary,
    loading,
    error,
    isReady: !!window.UXEnhancerEngine
  };
} 