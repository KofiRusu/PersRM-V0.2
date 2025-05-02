// Export main classes
export { UXAnalyzer } from './analyzer';
export { UXOptimizer } from './optimizer';
export { SimplePersRMAgent } from './simple-agent';
export { ComponentWatcher } from './watcher';
export { runCLI } from './cli';

// Export types
export * from './types';

// Export helper functions
export { generateMockEnhancementSummary, generateMockEnhancementSummaries } from './mockData';

/**
 * Create and return an analyzer instance
 */
export function createAnalyzer(config: any) {
  const { UXAnalyzer } = require('./analyzer');
  return new UXAnalyzer(config);
}

/**
 * Create and return an optimizer instance
 */
export function createOptimizer(config: any) {
  const { UXOptimizer } = require('./optimizer');
  return new UXOptimizer(config);
}

/**
 * Create and return a simple agent instance
 */
export function createSimpleAgent(config: any) {
  const { SimplePersRMAgent } = require('./simple-agent');
  return new SimplePersRMAgent(config);
}

/**
 * Create and return a component watcher
 */
export function createWatcher(config: any, paths: string[]) {
  const { ComponentWatcher } = require('./watcher');
  const watcher = new ComponentWatcher(config);
  
  if (paths && paths.length > 0) {
    watcher.start(paths, (result) => {
      console.log(`Analysis completed for component: ${result.componentName}`);
    });
  }
  
  return watcher;
} 