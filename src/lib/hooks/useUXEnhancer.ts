import { useState, useEffect, useCallback } from 'react';
import { validateEnhancementSummary } from '../ux-enhancer/validation';

export interface UXEnhancerEngine {
  analyze: (options?: any) => Promise<void>;
  onProgress: (callback: (progress: number) => void) => () => void;
  onComplete: (callback: (summary: any) => void) => () => void;
  onError: (callback: (error: Error) => void) => () => void;
  generateReport: (path?: string) => Promise<string>;
  isAnalyzing: () => boolean;
}

interface UseUXEnhancerOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseUXEnhancerResult {
  summary: any | null;
  error: Error | null;
  loading: boolean;
  analyzing: boolean;
  progress: number;
  analyze: (options?: any) => Promise<void>;
  generateReport: (path?: string) => Promise<string>;
  isValid: boolean;
  validationErrors: string[];
}

/**
 * Custom hook for interacting with the UX Enhancer Engine
 * 
 * @param engine The UX Enhancer Engine instance
 * @param options Configuration options
 * @returns Hook result with state and methods
 */
export function useUXEnhancer(
  engine: UXEnhancerEngine,
  options: UseUXEnhancerOptions = {}
): UseUXEnhancerResult {
  const { autoRefresh = false, refreshInterval = 60000 } = options;
  
  const [summary, setSummary] = useState<any | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [isValid, setIsValid] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Analyze function
  const analyze = useCallback(async (analyzeOptions?: any) => {
    try {
      setError(null);
      setLoading(true);
      setAnalyzing(true);
      setProgress(0);
      
      await engine.analyze(analyzeOptions);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [engine]);
  
  // Generate report function
  const generateReport = useCallback(async (path?: string): Promise<string> => {
    try {
      return await engine.generateReport(path);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [engine]);
  
  // Subscribe to engine events
  useEffect(() => {
    // Set initial state based on engine
    setAnalyzing(engine.isAnalyzing());
    
    // Subscribe to progress updates
    const unsubscribeProgress = engine.onProgress((newProgress) => {
      setProgress(newProgress);
    });
    
    // Subscribe to completion events
    const unsubscribeComplete = engine.onComplete((result) => {
      setSummary(result);
      setLoading(false);
      setAnalyzing(false);
      
      // Validate the summary
      const validation = validateEnhancementSummary(result);
      setIsValid(validation.valid);
      setValidationErrors(validation.errors);
    });
    
    // Subscribe to error events
    const unsubscribeError = engine.onError((err) => {
      setError(err);
      setLoading(false);
      setAnalyzing(false);
    });
    
    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeError();
    };
  }, [engine]);
  
  // Auto-refresh logic
  useEffect(() => {
    if (!autoRefresh) return;
    
    const refreshTimer = setInterval(() => {
      if (!analyzing) {
        analyze();
      }
    }, refreshInterval);
    
    return () => clearInterval(refreshTimer);
  }, [autoRefresh, refreshInterval, analyzing, analyze]);
  
  return {
    summary,
    error,
    loading,
    analyzing,
    progress,
    analyze,
    generateReport,
    isValid,
    validationErrors
  };
} 