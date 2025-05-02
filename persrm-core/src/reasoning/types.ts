/**
 * Types for the reasoning module
 */

export enum ReasoningMode {
  CHAIN_OF_THOUGHT = "chain_of_thought",
  SELF_REFLECTION = "self_reflection",
  TASK_DECOMPOSITION = "task_decomposition",
  PLANNING = "planning",
  AUTO = "auto"
}

export interface ReasoningStep {
  stepId: number;
  type: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface ReasoningTrace {
  steps: ReasoningStep[];
  mode?: ReasoningMode;
  metadata?: Record<string, any>;
}

export interface ReasoningResult {
  success: boolean;
  result?: {
    answer: string;
    reasoning: string;
  };
  trace?: ReasoningTrace;
  mode?: ReasoningMode;
  error?: string;
}

export interface ReasoningOptions {
  maxIterations?: number;
  saveToMemory?: boolean;
  context?: string;
}

export interface Reasoner {
  reason(
    query: string,
    context?: string,
    trace?: ReasoningTrace,
    modelProvider?: any,
    maxIterations?: number
  ): { answer: string; reasoning: string };
  
  evaluate?(trace: ReasoningTrace): Record<string, any>;
}

export interface ModelProvider {
  generate(prompt: string, options?: any): Promise<string>;
} 