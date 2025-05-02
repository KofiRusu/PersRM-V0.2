/**
 * ExecutionRecoveryService
 * 
 * A system to detect and recover from execution pauses or disruptions.
 * Monitors tool execution, saves execution state, and provides a mechanism
 * to resume development seamlessly.
 */

import { retentionService } from './retention';

interface ExecutionState {
  id: string;
  timestamp: number;
  type: 'reasoning' | 'code-generation' | 'tool-execution';
  status: 'in-progress' | 'paused' | 'completed' | 'failed';
  lastExecutionPoint: string;
  context: Record<string, any>;
  toolState?: Record<string, any>;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

class ExecutionRecoveryService {
  private sessions: Map<string, ExecutionState[]> = new Map();
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  private apiEndpoint: string | null = null;
  
  /**
   * Initialize the execution recovery service
   */
  public initialize(apiEndpoint: string = '/api/session-resume') {
    this.apiEndpoint = apiEndpoint;
    
    // Set up auto-save interval
    this.setupAutoSave();
    
    // Log initialization
    retentionService.trackEvent('execution-recovery-initialized');
    
    return this;
  }
  
  /**
   * Set up auto-save for execution states
   */
  private setupAutoSave(intervalMs: number = 30000) {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    this.autoSaveInterval = setInterval(() => {
      this.saveAllStates().catch(console.error);
    }, intervalMs);
  }
  
  /**
   * Save the current state of an execution
   */
  public saveExecutionState(
    sessionId: string,
    state: Omit<ExecutionState, 'id' | 'timestamp'>
  ): string {
    const executionId = crypto.randomUUID();
    
    const fullState: ExecutionState = {
      ...state,
      id: executionId,
      timestamp: Date.now(),
    };
    
    // Add to in-memory storage
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }
    
    const sessionStates = this.sessions.get(sessionId)!;
    sessionStates.push(fullState);
    
    // Store only last 50 states per session to avoid memory issues
    if (sessionStates.length > 50) {
      sessionStates.splice(0, sessionStates.length - 50);
    }
    
    // Send to API in background
    if (this.apiEndpoint) {
      fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, state: fullState }),
      }).catch(err => console.error('Failed to save execution state:', err));
    }
    
    // Log state save
    retentionService.trackEvent('execution-state-saved', {
      executionId,
      type: state.type,
      status: state.status,
    });
    
    return executionId;
  }
  
  /**
   * Get the most recent execution state for a session
   */
  public getLatestExecutionState(sessionId: string): ExecutionState | null {
    const sessionStates = this.sessions.get(sessionId);
    
    if (!sessionStates || sessionStates.length === 0) {
      return null;
    }
    
    // Get most recent state by timestamp
    return sessionStates.sort((a, b) => b.timestamp - a.timestamp)[0];
  }
  
  /**
   * Get execution state by ID
   */
  public getExecutionState(sessionId: string, executionId: string): ExecutionState | null {
    const sessionStates = this.sessions.get(sessionId);
    
    if (!sessionStates) {
      return null;
    }
    
    return sessionStates.find(state => state.id === executionId) || null;
  }
  
  /**
   * Update an existing execution state
   */
  public updateExecutionState(
    sessionId: string,
    executionId: string,
    updates: Partial<Omit<ExecutionState, 'id' | 'timestamp'>>
  ): boolean {
    const sessionStates = this.sessions.get(sessionId);
    
    if (!sessionStates) {
      return false;
    }
    
    const stateIndex = sessionStates.findIndex(state => state.id === executionId);
    
    if (stateIndex === -1) {
      return false;
    }
    
    // Update state
    sessionStates[stateIndex] = {
      ...sessionStates[stateIndex],
      ...updates,
      timestamp: Date.now(), // Update timestamp
    };
    
    // Send to API in background
    if (this.apiEndpoint) {
      fetch(`${this.apiEndpoint}?id=${executionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          state: sessionStates[stateIndex] 
        }),
      }).catch(err => console.error('Failed to update execution state:', err));
    }
    
    // Log state update
    retentionService.trackEvent('execution-state-updated', {
      executionId,
      status: sessionStates[stateIndex].status,
    });
    
    return true;
  }
  
  /**
   * Resume execution from a saved state
   */
  public async resumeExecution(
    sessionId: string, 
    executionId: string
  ): Promise<ExecutionState | null> {
    const state = this.getExecutionState(sessionId, executionId);
    
    if (!state) {
      console.error(`No execution state found with ID ${executionId}`);
      return null;
    }
    
    // Update state to in-progress
    this.updateExecutionState(sessionId, executionId, {
      status: 'in-progress',
    });
    
    // Log resumption
    retentionService.trackEvent('execution-resumed', {
      executionId,
      type: state.type,
    });
    
    return state;
  }
  
  /**
   * Save all execution states to the API
   */
  private async saveAllStates(): Promise<void> {
    if (!this.apiEndpoint) return;
    
    const allStates: { sessionId: string, states: ExecutionState[] }[] = [];
    
    // Collect all states by session
    this.sessions.forEach((states, sessionId) => {
      allStates.push({ sessionId, states });
    });
    
    // Skip if no states to save
    if (allStates.length === 0) return;
    
    // Send to API
    try {
      await fetch(`${this.apiEndpoint}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: allStates }),
      });
    } catch (error) {
      console.error('Failed to save execution states:', error);
    }
  }
  
  /**
   * Dispose resources (e.g., on service shutdown)
   */
  public dispose(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    
    // Final save of all states
    this.saveAllStates().catch(console.error);
  }
}

// Export singleton instance
export const executionRecoveryService = new ExecutionRecoveryService();
export default executionRecoveryService; 