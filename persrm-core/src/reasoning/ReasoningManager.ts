/**
 * Reasoning Manager
 * 
 * Coordinates different reasoning strategies and integrates with the model and memory system.
 */

import { 
  ModelProvider, 
  Reasoner, 
  ReasoningMode, 
  ReasoningOptions, 
  ReasoningResult, 
  ReasoningTrace 
} from './types';
import { ReasoningTraceManager } from './ReasoningTraceManager';

export class ReasoningManager {
  private modelProvider: ModelProvider;
  private reasoners: Map<ReasoningMode, Reasoner>;
  private memoryManager?: any; // This will be properly typed once we create the memory manager
  private defaultMode: ReasoningMode;
  private config: Record<string, any>;
  private currentTrace: ReasoningTraceManager;
  
  constructor(
    modelProvider: ModelProvider,
    options: {
      memoryManager?: any,
      defaultMode?: ReasoningMode,
      config?: Record<string, any>
    } = {}
  ) {
    this.modelProvider = modelProvider;
    this.memoryManager = options.memoryManager;
    this.defaultMode = options.defaultMode || ReasoningMode.AUTO;
    this.config = options.config || {};
    this.reasoners = new Map();
    this.currentTrace = new ReasoningTraceManager();
  }
  
  /**
   * Register a reasoner for a specific mode
   */
  registerReasoner(mode: ReasoningMode, reasoner: Reasoner): void {
    this.reasoners.set(mode, reasoner);
  }
  
  /**
   * Select the appropriate reasoning mode based on the query and context
   */
  private selectReasoningMode(query: string, context?: string): ReasoningMode {
    if (this.defaultMode !== ReasoningMode.AUTO) {
      return this.defaultMode;
    }
    
    // Simple heuristic-based selection (to be improved with more sophisticated logic)
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes("step by step") || 
        queryLower.includes("solve") || 
        queryLower.includes("calculate") || 
        queryLower.includes("math")) {
      return ReasoningMode.CHAIN_OF_THOUGHT;
    }
    
    if (queryLower.includes("plan") || 
        queryLower.includes("strategy") || 
        queryLower.includes("approach") || 
        queryLower.includes("steps to")) {
      return ReasoningMode.PLANNING;
    }
    
    if (queryLower.includes("break down") || 
        queryLower.includes("subtasks") || 
        queryLower.includes("components")) {
      return ReasoningMode.TASK_DECOMPOSITION;
    }
    
    if (queryLower.includes("review") || 
        queryLower.includes("improve") || 
        queryLower.includes("critique") || 
        queryLower.includes("reflect")) {
      return ReasoningMode.SELF_REFLECTION;
    }
    
    // Default to chain of thought if no clear match
    return ReasoningMode.CHAIN_OF_THOUGHT;
  }
  
  /**
   * Perform reasoning on a given query
   */
  reason(
    query: string,
    options: ReasoningOptions = {}
  ): Promise<ReasoningResult> {
    return new Promise(async (resolve, reject) => {
      try {
        // Extract options
        const { 
          context, 
          maxIterations = 5, 
          saveToMemory = true 
        } = options;
        
        // Select reasoning mode
        const selectedMode = options.mode || this.selectReasoningMode(query, context);
        
        // Initialize reasoning trace
        this.currentTrace = new ReasoningTraceManager();
        this.currentTrace.setMode(selectedMode);
        this.currentTrace.addMetadata("query", query);
        
        // Log the selected reasoning mode
        console.log(`Selected reasoning mode: ${selectedMode}`);
        this.currentTrace.addStep(`Selected reasoning mode: ${selectedMode}`, "metadata");
        
        // Get the appropriate reasoner
        const reasoner = this.reasoners.get(selectedMode);
        
        if (!reasoner) {
          const errorMsg = `No reasoner registered for mode: ${selectedMode}`;
          console.error(errorMsg);
          this.currentTrace.addStep(errorMsg, "error");
          
          resolve({
            success: false,
            error: errorMsg,
            trace: this.currentTrace.getTrace(),
            mode: selectedMode
          });
          return;
        }
        
        // Perform reasoning
        try {
          const result = await reasoner.reason(
            query,
            context,
            this.currentTrace.getTrace(),
            this.modelProvider,
            maxIterations
          );
          
          // Save reasoning trace to memory if enabled
          if (saveToMemory && this.memoryManager) {
            // We'll implement this when we have the memory manager
            // this.currentTrace.saveToMemory(this.memoryManager);
          }
          
          resolve({
            success: true,
            result,
            trace: this.currentTrace.getTrace(),
            mode: selectedMode
          });
        } catch (e) {
          const error = e as Error;
          const errorMsg = `Error during reasoning: ${error.message}`;
          console.error(errorMsg);
          this.currentTrace.addStep(errorMsg, "error");
          
          // Save reasoning trace to memory even if failed
          if (saveToMemory && this.memoryManager) {
            // We'll implement this when we have the memory manager
            // this.currentTrace.saveToMemory(this.memoryManager);
          }
          
          resolve({
            success: false,
            error: errorMsg,
            trace: this.currentTrace.getTrace(),
            mode: selectedMode
          });
        }
      } catch (e) {
        const error = e as Error;
        reject(new Error(`Failed to perform reasoning: ${error.message}`));
      }
    });
  }
  
  /**
   * Get a reasoning prompt for the selected mode
   */
  getReasoningPrompt(mode: ReasoningMode, query: string, context?: string): string {
    let basePrompt = `Query: ${query}\n\n`;
    
    if (context) {
      basePrompt += `Context: ${context}\n\n`;
    }
    
    if (mode === ReasoningMode.CHAIN_OF_THOUGHT) {
      basePrompt += "Let's solve this step-by-step:\n\n";
    } else if (mode === ReasoningMode.SELF_REFLECTION) {
      basePrompt += "Let me first generate an answer, then reflect on it:\n\n";
    } else if (mode === ReasoningMode.TASK_DECOMPOSITION) {
      basePrompt += "Let me break down this task into smaller components:\n\n";
    } else if (mode === ReasoningMode.PLANNING) {
      basePrompt += "Let me create a plan to address this:\n\n";
    }
    
    return basePrompt;
  }
  
  /**
   * Get the current reasoning trace
   */
  getCurrentTrace(): ReasoningTrace {
    return this.currentTrace.getTrace();
  }
} 