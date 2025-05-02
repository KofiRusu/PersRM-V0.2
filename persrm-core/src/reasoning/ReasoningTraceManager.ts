/**
 * Reasoning Trace Manager
 * 
 * Manages the creation, modification, and serialization of reasoning traces.
 */

import { ReasoningMode, ReasoningStep, ReasoningTrace } from './types';

export class ReasoningTraceManager {
  private trace: ReasoningTrace;
  
  constructor() {
    this.trace = {
      steps: [],
      metadata: {}
    };
  }
  
  /**
   * Set the reasoning mode
   */
  setMode(mode: ReasoningMode): void {
    this.trace.mode = mode;
  }
  
  /**
   * Add metadata to the trace
   */
  addMetadata(key: string, value: any): void {
    if (!this.trace.metadata) {
      this.trace.metadata = {};
    }
    this.trace.metadata[key] = value;
  }
  
  /**
   * Add a step to the reasoning trace
   */
  addStep(content: string, type: string = "thought", metadata?: Record<string, any>): number {
    const stepId = this.trace.steps.length;
    
    const step: ReasoningStep = {
      stepId,
      type,
      content,
      metadata
    };
    
    this.trace.steps.push(step);
    return stepId;
  }
  
  /**
   * Get the full reasoning trace as a formatted string
   */
  getFullTrace(): string {
    let traceStr = "";
    
    for (const step of this.trace.steps) {
      if (step.type === "thought") {
        traceStr += `Thought: ${step.content}\n\n`;
      } else if (step.type === "action") {
        traceStr += `Action: ${step.content}\n\n`;
      } else if (step.type === "observation") {
        traceStr += `Observation: ${step.content}\n\n`;
      } else {
        traceStr += `${step.type.charAt(0).toUpperCase() + step.type.slice(1)}: ${step.content}\n\n`;
      }
    }
    
    return traceStr;
  }
  
  /**
   * Get the last step in the reasoning trace
   */
  getLastStep(): ReasoningStep | null {
    if (this.trace.steps.length === 0) {
      return null;
    }
    return this.trace.steps[this.trace.steps.length - 1];
  }
  
  /**
   * Convert the reasoning trace to a JSON string
   */
  toJson(): string {
    return JSON.stringify(this.trace, null, 2);
  }
  
  /**
   * Create a reasoning trace from a JSON string
   */
  static fromJson(json: string): ReasoningTraceManager {
    const data = JSON.parse(json) as ReasoningTrace;
    const manager = new ReasoningTraceManager();
    manager.trace = data;
    return manager;
  }
  
  /**
   * Get the trace object
   */
  getTrace(): ReasoningTrace {
    return this.trace;
  }
} 