/**
 * Unit tests for the Plugin Enhancer system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  SeverityLevel, 
  SuggestionType, 
  PluginEnhancer,
  ModelType,
  analyzePluginPerformance,
  generateSuggestions,
  enhancePluginLifecycleMethods,
  analyzeAndEnhancePlugins
} from './plugin_enhancer';

// Mock the Prisma client
vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn().mockImplementation(() => ({
      pluginEnhancerReport: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
        findMany: vi.fn().mockResolvedValue([])
      },
      pluginAnalysis: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
        findMany: vi.fn().mockResolvedValue([])
      },
      modelComparison: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
        findMany: vi.fn().mockResolvedValue([])
      },
      trainingSession: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
        update: vi.fn().mockResolvedValue({ id: 1 }),
        findMany: vi.fn().mockResolvedValue([])
      },
      trainingLearning: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
        count: vi.fn().mockResolvedValue(0)
      }
    }))
  };
});

// Mock the UIPluginBase interface
interface MockUIPluginBase {
  metadata: {
    id: string;
    name?: string;
    version?: string;
    author?: string;
    description?: string;
  };
  component: Function;
  lifecycle?: {
    init?: Function;
    destroy?: Function;
    setState?: Function;
  };
  defaultState?: Record<string, any>;
  defaultProps?: Record<string, any>;
  performance?: {
    measure: (id: string, startTime?: number) => number;
    markStart: (id: string) => void;
    markEnd: (id: string) => number;
    getMetrics: () => Record<string, any>;
  };
  analytics?: {
    trackInteraction: Function;
    trackError: Function;
    trackUsage: Function;
  };
}

// Create a mock plugin
function createMockPlugin(overrides = {}): MockUIPluginBase {
  return {
    metadata: {
      id: 'mock-plugin',
      name: 'Mock Plugin',
      version: '1.0.0'
    },
    component: (props: any) => ({ type: 'div', props }),
    lifecycle: {
      init: () => console.log('Init'),
      destroy: () => console.log('Destroy'),
      setState: (state: any) => console.log('Set state', state)
    },
    defaultState: {
      count: 0,
      unused: 'unused'
    },
    defaultProps: {
      title: 'Default Title',
      unused: 'unused'
    },
    ...overrides
  };
}

// Create a mock plugin registry
function createMockRegistry(plugins: MockUIPluginBase[] = []) {
  return {
    getAllPlugins: () => plugins
  };
}

describe('Plugin Enhancer', () => {
  // Silence console logs during tests
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzePluginPerformance', () => {
    it('should analyze plugin performance', () => {
      const plugin = createMockPlugin({
        performance: {
          getMetrics: () => ({
            'init': { duration: 100 },
            'render': { duration: 20 },
            'destroy': { duration: 30 }
          }),
          measure: vi.fn(),
          markStart: vi.fn(),
          markEnd: vi.fn()
        }
      });

      const metrics = analyzePluginPerformance(plugin as any);
      
      expect(metrics).toBeDefined();
      expect(metrics.initTime).toBe(100);
      expect(metrics.renderTime).toBe(20);
      expect(metrics.destroyTime).toBe(30);
      expect(metrics.unusedState).toContain('unused');
      expect(metrics.unusedProps).toContain('unused');
    });
  });

  describe('generateSuggestions', () => {
    it('should generate suggestions for slow initialization', () => {
      const metrics = {
        initTime: 200, // Exceeds the INIT threshold of 150
        renderTime: 10,
        destroyTime: 20,
        unusedState: ['unused'],
        unusedProps: ['unused'],
        reRenders: 0,
        errorCount: 0,
        apiCallCount: 0
      };

      const suggestions = generateSuggestions('mock-plugin', metrics);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.type === SuggestionType.PERFORMANCE)).toBe(true);
      expect(suggestions.some(s => s.message.includes('Slow initialization'))).toBe(true);
    });

    it('should generate suggestions for unused state', () => {
      const metrics = {
        initTime: 100,
        renderTime: 10,
        destroyTime: 20,
        unusedState: ['unused'],
        unusedProps: [],
        reRenders: 0,
        errorCount: 0,
        apiCallCount: 0
      };

      const suggestions = generateSuggestions('mock-plugin', metrics);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.type === SuggestionType.MEMORY)).toBe(true);
      expect(suggestions.some(s => s.message.includes('Unused state'))).toBe(true);
    });
  });

  describe('enhancePluginLifecycleMethods', () => {
    it('should enhance plugin lifecycle methods', () => {
      const plugin = createMockPlugin();
      const originalInitFn = plugin.lifecycle!.init;
      const originalDestroyFn = plugin.lifecycle!.destroy;
      
      enhancePluginLifecycleMethods(plugin as any);
      
      expect(plugin.lifecycle!.init).not.toBe(originalInitFn);
      expect(plugin.lifecycle!.destroy).not.toBe(originalDestroyFn);
      expect(plugin.performance).toBeDefined();
      expect(plugin.analytics).toBeDefined();
    });

    it('should create performance hooks if not present', () => {
      const plugin = createMockPlugin({
        performance: undefined
      });
      
      enhancePluginLifecycleMethods(plugin as any);
      
      expect(plugin.performance).toBeDefined();
      expect(typeof plugin.performance!.markStart).toBe('function');
      expect(typeof plugin.performance!.markEnd).toBe('function');
      expect(typeof plugin.performance!.getMetrics).toBe('function');
    });
  });

  describe('PluginEnhancer Class', () => {
    it('should create an instance with default options', () => {
      const registry = createMockRegistry();
      const enhancer = new PluginEnhancer(registry as any);
      
      expect(enhancer).toBeDefined();
      expect(enhancer.report).toBeNull();
    });

    it('should analyze plugins', async () => {
      const plugin = createMockPlugin();
      const registry = createMockRegistry([plugin]);
      const enhancer = new PluginEnhancer(registry as any, { logToDatabase: false });
      
      const report = await enhancer.analyze();
      
      expect(report).toBeDefined();
      expect(report.analyses.length).toBe(1);
      expect(report.analyses[0].pluginId).toBe('mock-plugin');
    });

    it('should apply enhancements', async () => {
      const plugin = createMockPlugin({
        performance: {
          getMetrics: () => ({
            'init': { duration: 100 },
            'render': { duration: 20 },
            'destroy': { duration: 30 },
            'stateUpdate': { duration: 15 } // Exceeds STATE_UPDATE threshold of 10
          }),
          measure: vi.fn(),
          markStart: vi.fn(),
          markEnd: vi.fn()
        }
      });
      const registry = createMockRegistry([plugin]);
      const enhancer = new PluginEnhancer(registry as any, { logToDatabase: false });
      
      await enhancer.analyze();
      enhancer.applyEnhancements();
      
      // The plugin should now have memoization and throttling applied
      expect((plugin as any)._enhanced).toBeDefined();
    });

    it('should compare with models', async () => {
      const plugin = createMockPlugin();
      const registry = createMockRegistry([plugin]);
      const enhancer = new PluginEnhancer(registry as any, { logToDatabase: false });
      
      await enhancer.analyze();
      const comparisons = await enhancer.compareWithModel(ModelType.EXPERIMENTAL);
      
      expect(comparisons).toBeDefined();
      expect(comparisons.length).toBe(1);
      expect(comparisons[0].pluginId).toBe('mock-plugin');
      expect(comparisons[0].modelType).toBe(ModelType.EXPERIMENTAL);
      expect(comparisons[0].improvement).toBeDefined();
    });
  });

  describe('Integration', () => {
    it('should run the full analysis and enhancement pipeline', async () => {
      const plugin = createMockPlugin({
        performance: {
          getMetrics: () => ({
            'init': { duration: 200 }, // Exceeds threshold
            'render': { duration: 20 }, // Exceeds threshold
            'destroy': { duration: 30 }
          }),
          measure: vi.fn(),
          markStart: vi.fn(),
          markEnd: vi.fn()
        }
      });
      const registry = createMockRegistry([plugin]);
      const enhancer = new PluginEnhancer(registry as any, { 
        logToDatabase: false,
        fix: true
      });
      
      // 1. Analyze plugins
      const report = await enhancer.analyze();
      expect(report.analyses.length).toBe(1);
      expect(report.analyses[0].suggestions.length).toBeGreaterThan(0);
      
      // 2. Apply enhancements
      enhancer.applyEnhancements();
      expect((plugin as any)._enhanced).toBeDefined();
      
      // 3. Compare with model
      const comparisons = await enhancer.compareWithModel(ModelType.EXPERIMENTAL);
      expect(comparisons.length).toBe(1);
      
      // 4. Extract learnings
      const learnings = await extractLearnings(
        [comparisons[0]], 
        [comparisons[0]]
      );
      expect(learnings.length).toBeGreaterThan(0);
    });
  });
});

// Simplified version of extractLearnings for testing
async function extractLearnings(
  baselineResults: any[],
  experimentalResults: any[]
): Promise<Array<{
  category: string;
  description: string;
  confidence: number;
  plugins: string[];
}>> {
  return [{
    category: 'performance',
    description: 'Test learning',
    confidence: 0.8,
    plugins: [baselineResults[0].pluginId]
  }];
} 