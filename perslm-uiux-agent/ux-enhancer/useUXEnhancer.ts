import { useState, useEffect } from 'react';
import { 
  PhaseType, 
  SeverityLevel, 
  ReportFormat, 
  EnhancementSummary, 
  UXScoreProgress, 
  ReportConfig 
} from './types';
import { UXEnhancerEngine } from './UXEnhancerEngine';

export function useUXEnhancer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<PhaseType | null>(null);
  const [progress, setProgress] = useState<UXScoreProgress | null>(null);
  const [results, setResults] = useState<EnhancementSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handlePhaseStart = (phase: PhaseType) => {
      setCurrentPhase(phase);
      setProgress({
        percentage: 0,
        total: 100,
        completed: 0
      });
    };

    const handlePhaseProgress = (phaseProgress: UXScoreProgress) => {
      setProgress(phaseProgress);
    };

    const handleAnalysisComplete = (summary: EnhancementSummary) => {
      setResults(summary);
      setIsAnalyzing(false);
      setCurrentPhase(null);
      setProgress(null);
    };

    const handleAnalysisError = (errorMessage: string) => {
      setError(errorMessage);
      setIsAnalyzing(false);
      setCurrentPhase(null);
      setProgress(null);
    };

    // Subscribe to UXEnhancerEngine events
    UXEnhancerEngine.on('phaseStart', handlePhaseStart);
    UXEnhancerEngine.on('phaseProgress', handlePhaseProgress);
    UXEnhancerEngine.on('analysisComplete', handleAnalysisComplete);
    UXEnhancerEngine.on('analysisError', handleAnalysisError);

    // Cleanup subscriptions on unmount
    return () => {
      UXEnhancerEngine.off('phaseStart', handlePhaseStart);
      UXEnhancerEngine.off('phaseProgress', handlePhaseProgress);
      UXEnhancerEngine.off('analysisComplete', handleAnalysisComplete);
      UXEnhancerEngine.off('analysisError', handleAnalysisError);
    };
  }, []);

  const startAnalysis = async (pluginId: string) => {
    try {
      setIsAnalyzing(true);
      setError(null);
      setResults(null);
      
      await UXEnhancerEngine.startAnalysis(pluginId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
      setIsAnalyzing(false);
    }
  };

  const cancelAnalysis = () => {
    UXEnhancerEngine.cancelAnalysis();
    setIsAnalyzing(false);
    setCurrentPhase(null);
    setProgress(null);
  };

  const downloadReport = async (
    summary: EnhancementSummary,
    config: ReportConfig
  ) => {
    try {
      await UXEnhancerEngine.generateReport(summary, config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    }
  };

  const validateResults = (summary: EnhancementSummary) => {
    if (!summary) return false;
    
    // Check all required phases exist
    const hasAllPhases = Object.values(PhaseType).every(
      phase => summary.phases[phase] !== undefined
    );
    
    // Check for minimum score and issue requirements
    const isValid = hasAllPhases && Object.values(summary.phases).every(
      phase => typeof phase.score === 'number' && Array.isArray(phase.issues)
    );
    
    return isValid;
  };

  return {
    isAnalyzing,
    currentPhase,
    progress,
    results,
    error,
    startAnalysis,
    cancelAnalysis,
    downloadReport,
    validateResults,
  };
} 