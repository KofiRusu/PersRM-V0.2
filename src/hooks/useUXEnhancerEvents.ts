import { useState, useEffect } from "react";
import { UXEnhancerEngine } from "@/lib/ux-enhancer/UXEnhancerEngine";
import { PhaseResult } from "@/lib/ux-enhancer/types";

/**
 * Custom hook to subscribe to UXEnhancerEngine events and provide live updates
 */
export function useUXEnhancerEvents(engine: UXEnhancerEngine) {
  const [phaseUpdates, setPhaseUpdates] = useState<PhaseResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [activePhase, setActivePhase] = useState<string | null>(null);

  useEffect(() => {
    if (!engine) return;

    // Handler for phase start events
    const handlePhaseStart = (phase: string) => {
      setActivePhase(phase);
    };

    // Handler for phase complete events
    const handlePhaseComplete = (result: PhaseResult) => {
      setPhaseUpdates((prev) => {
        // Replace existing phase result or add new one
        const existing = prev.findIndex((p) => p.type === result.type);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = result;
          return updated;
        }
        return [...prev, result];
      });
    };

    // Handler for analysis start event
    const handleAnalysisStart = () => {
      setIsAnalyzing(true);
      setPhaseUpdates([]);
    };

    // Handler for analysis complete event
    const handleAnalysisComplete = () => {
      setIsAnalyzing(false);
      setActivePhase(null);
    };

    // Subscribe to events
    engine.on("analysisStart", handleAnalysisStart);
    engine.on("analysisComplete", handleAnalysisComplete);
    engine.on("phaseStart", handlePhaseStart);
    engine.on("phaseComplete", handlePhaseComplete);

    // Cleanup subscriptions on unmount
    return () => {
      engine.off("analysisStart", handleAnalysisStart);
      engine.off("analysisComplete", handleAnalysisComplete);
      engine.off("phaseStart", handlePhaseStart);
      engine.off("phaseComplete", handlePhaseComplete);
    };
  }, [engine]);

  return {
    phaseUpdates,
    isAnalyzing,
    activePhase,
  };
}
