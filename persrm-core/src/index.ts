/**
 * PersRM Core
 * 
 * Core reasoning model for PersRM, separating the reasoning engine from user interfaces.
 */

// Export reasoning module
export * from './reasoning';

// Export memory module
export * from './memory';

/**
 * Start the reasoning process on a query
 */
export async function startReasoning(
  query: string, 
  options?: {
    context?: string;
    mode?: string;
    saveToMemory?: boolean;
  }
) {
  // This is a placeholder. In a real implementation, this would instantiate
  // the reasoning manager with the appropriate model provider and memory manager,
  // then call the reason method.
  
  throw new Error('Not yet implemented');
}

/**
 * Get recent reasoning sessions 
 */
export async function getRecentSessions(limit: number = 10) {
  // This is a placeholder. In a real implementation, this would retrieve
  // recent reasoning sessions from storage.
  
  throw new Error('Not yet implemented');
}

/**
 * Save feedback on a reasoning session
 */
export async function saveFeedback(sessionId: string, feedback: Record<string, any>) {
  // This is a placeholder. In a real implementation, this would save
  // feedback on a reasoning session.
  
  throw new Error('Not yet implemented');
} 