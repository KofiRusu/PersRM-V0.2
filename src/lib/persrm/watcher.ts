import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { generateMockEnhancementSummary } from './mockData';
import { ComponentType, PersRMConfig, UXEnhancementSummary } from './types';

// Constants
const DEBOUNCE_DELAY = 300; // ms

// Extended configuration interface for watcher-specific properties
interface WatcherConfig extends PersRMConfig {
  analyzeExisting?: boolean;
}

/**
 * Component Watcher that monitors JSX/TSX files for changes and performs UX analysis
 */
export class ComponentWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private config: WatcherConfig;
  private analysisQueue: Set<string> = new Set();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(config: PersRMConfig) {
    this.config = config as WatcherConfig;
    
    // Set default value for analyzeExisting if not provided
    if (this.config.analyzeExisting === undefined) {
      this.config.analyzeExisting = true;
    }
  }
  
  /**
   * Start watching component files for changes
   * @param paths Glob patterns of paths to watch
   * @param onAnalysisComplete Callback when an analysis is completed
   */
  public start(
    paths: string[],
    onAnalysisComplete: (result: UXEnhancementSummary) => void
  ): void {
    if (this.watcher) {
      this.stop();
    }

    if (this.config.verbose) {
      console.log(`Starting watcher for paths: ${paths.join(', ')}`);
    }
    
    // Initialize watcher
    this.watcher = chokidar.watch(paths, {
      ignored: /(node_modules|dist|\.git)/,
      persistent: true,
      ignoreInitial: !this.config.analyzeExisting
    });
    
    // Setup event handlers
    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath, onAnalysisComplete))
      .on('change', (filePath) => this.handleFileChange(filePath, onAnalysisComplete))
      .on('error', (error) => console.error(`Watcher error: ${error}`))
      .on('ready', () => {
        if (this.config.verbose) {
          console.log('Initial scan complete. Watching for changes...');
        }
      });
  }
  
  /**
   * Stop watching files
   */
  public stop(): void {
    if (this.watcher) {
      this.watcher.close().then(() => {
        if (this.config.verbose) {
          console.log('Watcher stopped');
        }
        this.watcher = null;
      });
    }
    
    // Clear any pending timers
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
    this.analysisQueue.clear();
  }
  
  /**
   * Handle file change events
   */
  private handleFileChange(
    filePath: string, 
    onAnalysisComplete: (result: UXEnhancementSummary) => void
  ): void {
    const absolutePath = path.resolve(filePath);
    
    // Skip non-component files based on extension
    const ext = path.extname(filePath).toLowerCase();
    if (!['.jsx', '.tsx', '.js', '.ts'].includes(ext)) {
      return;
    }
    
    // Skip files that don't match our component pattern
    // This is a simple heuristic - in a real implementation, you'd
    // parse the file to determine if it's actually a component
    const fileName = path.basename(filePath, ext);
    if (!/^[A-Z]/.test(fileName)) {
      if (this.config.verbose) {
        console.log(`Skipping ${filePath} (doesn't match component naming pattern)`);
      }
      return;
    }
    
    // Debounce the analysis to avoid multiple runs when files change rapidly
    if (this.debounceTimers.has(absolutePath)) {
      clearTimeout(this.debounceTimers.get(absolutePath));
    }
    
    this.analysisQueue.add(absolutePath);
    
    this.debounceTimers.set(
      absolutePath,
      setTimeout(() => {
        this.analyzeComponent(absolutePath, onAnalysisComplete);
        this.analysisQueue.delete(absolutePath);
        this.debounceTimers.delete(absolutePath);
      }, DEBOUNCE_DELAY)
    );
  }
  
  /**
   * Analyze a component file
   * For now, this generates mock data. In a real implementation,
   * this would analyze the component using static analysis, runtime metrics, etc.
   */
  private analyzeComponent(
    filePath: string,
    onAnalysisComplete: (result: UXEnhancementSummary) => void
  ): void {
    const componentName = path.basename(filePath, path.extname(filePath));
    
    if (this.config.verbose) {
      console.log(`Analyzing component: ${componentName} (${filePath})`);
    }
    
    try {
      // In a real implementation, read the file and analyze it
      // For now, we'll just generate mock data
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Use CUSTOM for all components since CLASS and FUNCTIONAL don't exist in the ComponentType enum
      const componentType = ComponentType.CUSTOM;
      
      // Generate mock analysis result and explicitly cast it to UXEnhancementSummary
      const mockResult = generateMockEnhancementSummary(componentName, componentType);
      const result = mockResult as UXEnhancementSummary;
      
      // Call the completion callback
      onAnalysisComplete(result);
      
    } catch (error) {
      console.error(`Error analyzing ${componentName}: ${error}`);
    }
  }
}

/**
 * Create and initialize a component watcher
 * @param config PersRM configuration
 * @param paths Array of paths to watch
 */
export function createWatcher(config: PersRMConfig, paths: string[]): ComponentWatcher {
  const watcher = new ComponentWatcher(config);
  
  if (paths.length > 0) {
    watcher.start(paths, (result) => {
      console.log('Analysis completed:', JSON.stringify(result, null, 2));
    });
  }
  
  return watcher;
} 