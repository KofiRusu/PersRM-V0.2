import { PersRMAgent } from '../lib/persrm/agent';
import { AgentMode, PersRMConfig } from '../lib/persrm/types';
import { logger, LogLevel } from '../lib/utils/logger';
import * as path from 'path';
import * as fs from 'fs-extra';

/**
 * Options for initializing the PersRM Agent
 */
export interface CursorPersRMOptions extends Partial<PersRMConfig> {
  autoOptimize?: boolean;
  watchPath?: string;
}

/**
 * Result interface for agent operations
 */
export interface AgentOperationResult {
  success: boolean;
  overallScore?: number;
  maxScore?: number;
  issuesCount?: number;
  suggestionsCount?: number;
  reportPath?: string;
  error?: string;
}

/**
 * PersRM Agent - Entry point for Cursor integration
 */
export class CursorPersRMAgent {
  private agent: PersRMAgent;
  private workspacePath: string;
  private options: CursorPersRMOptions;
  private outputDir: string;

  /**
   * Initialize the PersRM Agent
   */
  constructor(workspacePath: string, options: CursorPersRMOptions = {}) {
    this.workspacePath = workspacePath;
    this.options = options;
    
    // Set up logging
    logger.configure({
      level: options.verbose ? LogLevel.DEBUG : LogLevel.INFO
    });
    
    // Initialize config with sensible defaults
    const config: PersRMConfig = {
      projectPath: workspacePath,
      outputDir: path.join(workspacePath, options.outputDir || 'persrm-output'),
      mode: AgentMode.ANALYSIS,
      verbose: options.verbose || false,
      takeScreenshots: options.takeScreenshots || false,
      designSystemPath: options.designSystemPath,
      ciMode: options.ciMode || false,
      prNumber: options.prNumber,
      branch: options.branch,
      githubToken: options.githubToken
    };
    
    // Store output dir
    this.outputDir = config.outputDir;
    
    // Initialize the agent
    this.agent = new PersRMAgent(config);
    
    logger.info(`PersRM Agent initialized for workspace: ${workspacePath}`);
  }

  /**
   * Run UX analysis on the current workspace
   */
  async analyzeProject(): Promise<AgentOperationResult> {
    logger.info('Starting project analysis...');
    
    try {
      const result = await this.agent.analyze();
      
      if (result.success) {
        logger.success('Analysis completed successfully');
        return {
          success: true,
          overallScore: result.summary.overallScore,
          maxScore: result.summary.maxScore,
          issuesCount: result.issues.length,
          reportPath: path.join(this.outputDir, 'analysis-result.json')
        };
      } else {
        logger.error('Analysis failed:', result.error);
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      logger.error('Error during analysis:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate a UX report
   */
  async generateReport(inputPath?: string, format: 'html' | 'md' | 'json' = 'html'): Promise<AgentOperationResult> {
    logger.info('Generating UX report...');
    
    try {
      const reportOptions = {
        format,
        includeScreenshots: true,
        includeDiffs: true,
        compareWithPrevious: false
      };
      
      // Use runTask instead of direct method call since generateReport is private
      const result = await this.agent.runTask();
      const reportPath = path.join(this.outputDir, `report.${format}`);
      
      return {
        success: true,
        reportPath
      };
    } catch (error) {
      logger.error('Error generating report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Run component optimization
   */
  async optimizeComponents(): Promise<AgentOperationResult> {
    logger.info('Starting component optimization...');
    
    try {
      const result = await this.agent.optimize();
      
      if (result.success) {
        logger.success('Optimization completed successfully');
        return {
          success: true,
          overallScore: result.summary.overallScore,
          maxScore: result.summary.maxScore,
          issuesCount: result.issues.length,
          suggestionsCount: result.suggestions.length,
          reportPath: path.join(this.outputDir, 'optimization-result.json')
        };
      } else {
        logger.error('Optimization failed:', result.error);
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      logger.error('Error during optimization:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Returns the current workspace path
   */
  getWorkspacePath(): string {
    return this.workspacePath;
  }

  /**
   * Returns the output directory path
   */
  getOutputPath(): string {
    return this.outputDir;
  }

  /**
   * Returns whether auto-optimization is enabled
   */
  isAutoOptimizeEnabled(): boolean {
    return !!this.options.autoOptimize;
  }

  /**
   * Returns the current watch path
   */
  getWatchPath(): string {
    return this.options.watchPath || './src/components';
  }

  /**
   * Enable auto-optimization
   */
  enableAutoOptimize(watchPath?: string): void {
    this.options.autoOptimize = true;
    if (watchPath) {
      this.options.watchPath = watchPath;
    }
    logger.info(`Auto-optimization enabled. Watching: ${this.getWatchPath()}`);
  }

  /**
   * Disable auto-optimization
   */
  disableAutoOptimize(): void {
    this.options.autoOptimize = false;
    logger.info('Auto-optimization disabled');
  }
}

// Export a factory function as default
export default function createPersRMAgent(workspacePath: string, options: CursorPersRMOptions = {}): CursorPersRMAgent {
  return new CursorPersRMAgent(workspacePath, options);
} 