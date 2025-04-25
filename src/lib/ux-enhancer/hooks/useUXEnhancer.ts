import { useState, useEffect } from 'react';
import type { EnhancementSummary, UXEnhancerEvents, UXIssue } from '../types';

interface UXEnhancerState {
  loading: boolean;
  analyzing: boolean;
  summary: EnhancementSummary | null;
  error: string | null;
  progress: number;
  latestIssue: UXIssue | null;
}

interface UXEnhancerOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * Hook to subscribe to UX Enhancer events
 */
export function useUXEnhancer(engineInstance: any, options: UXEnhancerOptions = {}) {
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  
  const [state, setState] = useState<UXEnhancerState>({
    loading: true,
    analyzing: false,
    summary: null,
    error: null,
    progress: 0,
    latestIssue: null,
  });

  useEffect(() => {
    if (!engineInstance) {
      setState(prev => ({ ...prev, error: 'UX Enhancer engine not provided', loading: false }));
      return;
    }

    // Subscribe to events
    const subscriptions = [
      engineInstance.on(UXEnhancerEvents.UPDATE, (data: { progress: number }) => {
        setState(prev => ({
          ...prev,
          progress: data.progress,
          analyzing: true,
          loading: false,
        }));
      }),

      engineInstance.on(UXEnhancerEvents.ISSUE_DETECTED, (issue: UXIssue) => {
        setState(prev => ({
          ...prev,
          latestIssue: issue,
        }));
      }),

      engineInstance.on(UXEnhancerEvents.ANALYSIS_COMPLETE, (summary: EnhancementSummary) => {
        setState(prev => ({
          ...prev,
          summary,
          analyzing: false,
          loading: false,
          progress: 100,
        }));
      }),

      engineInstance.on(UXEnhancerEvents.ERROR, (error: string) => {
        setState(prev => ({
          ...prev,
          error,
          analyzing: false,
          loading: false,
        }));
      }),
    ];

    // Initial loading of data
    setState(prev => ({ ...prev, loading: true }));
    engineInstance.getLatestSummary()
      .then((summary: EnhancementSummary | null) => {
        setState(prev => ({
          ...prev,
          summary,
          loading: false,
          progress: summary ? 100 : 0,
        }));
      })
      .catch((error: Error) => {
        setState(prev => ({
          ...prev,
          error: error.message,
          loading: false,
        }));
      });

    // Set up auto-refresh if enabled
    let intervalId: NodeJS.Timeout | null = null;
    if (autoRefresh && refreshInterval > 0) {
      intervalId = setInterval(() => {
        if (!state.analyzing) {
          engineInstance.analyze();
        }
      }, refreshInterval);
    }

    // Cleanup
    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
      if (intervalId) clearInterval(intervalId);
    };
  }, [engineInstance, autoRefresh, refreshInterval]);

  // Methods to control the enhancer
  const analyze = () => {
    if (!engineInstance || state.analyzing) return;
    setState(prev => ({ ...prev, analyzing: true, progress: 0 }));
    engineInstance.analyze();
  };

  const cancelAnalysis = () => {
    if (!engineInstance || !state.analyzing) return;
    engineInstance.cancelAnalysis();
    setState(prev => ({ ...prev, analyzing: false }));
  };

  const downloadReport = async (format: 'json' | 'pdf' | 'html' = 'json') => {
    if (!engineInstance || !state.summary) return null;
    return engineInstance.generateReport(state.summary.id, { format });
  };

  return {
    ...state,
    analyze,
    cancelAnalysis,
    downloadReport,
  };
} 