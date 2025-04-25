import { SimplePersRMAgent } from './simple-agent';
import { PersRMAgent } from './agent';
import { PersRMConfig } from './types';

/**
 * AgentMode represents the operation mode for PersRM
 */
export enum AgentMode {
  MOCK = 'mock',
  PROD = 'prod'
}

/**
 * Extended interface to ensure compatibility between different agent implementations
 */
export interface CommonAgentInterface {
  analyze(targetPath: string): Promise<any>;
  optimize(targetPath: string): Promise<any>;
  analyzeDirectory?(targetPath: string): Promise<any[]>;
  generateReportFromResult?(resultPath: string, options: any): Promise<any>;
  saveResults?(): string;
  getResults?(): any[];
}

/**
 * Returns the active PersRM agent based on environment variable or specified mode
 * @param config Configuration object for the agent
 * @param forcedMode Optional mode to override environment variable
 * @returns Appropriate PersRM agent (Simple Mock or Real)
 */
export function getActiveAgent(config: PersRMConfig, forcedMode?: AgentMode): CommonAgentInterface {
  // Determine mode: forced mode, environment variable, or default to mock
  const mode = forcedMode || process.env.PERSRM_MODE || AgentMode.MOCK;
  
  // Log which mode is active
  console.log(`PersRM running in ${mode === AgentMode.PROD ? 'PRODUCTION' : 'MOCK'} mode`);
  
  // Return the appropriate agent
  if (mode === AgentMode.PROD) {
    return new PersRMAgent(config);
  } else {
    return new SimplePersRMAgent(config);
  }
}

/**
 * Determines if the current mode is real/production
 * @param forcedMode Optional mode to override environment variable
 * @returns True if in production mode, false otherwise
 */
export function isProductionMode(forcedMode?: AgentMode): boolean {
  const mode = forcedMode || process.env.PERSRM_MODE || AgentMode.MOCK;
  return mode === AgentMode.PROD;
}

/**
 * Gets the current mode string (for display purposes)
 * @param forcedMode Optional mode to override environment variable 
 * @returns Mode string ("prod" or "mock")
 */
export function getCurrentModeString(forcedMode?: AgentMode): string {
  const mode = forcedMode || process.env.PERSRM_MODE || AgentMode.MOCK;
  return mode;
} 