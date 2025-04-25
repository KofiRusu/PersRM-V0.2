#!/usr/bin/env node
import chokidar from 'chokidar';
import path from 'path';
import chalk from 'chalk';
import fs from 'fs-extra';
import { Command } from 'commander';
import { getActiveAgent, AgentMode } from '../lib/persrm/agent-switcher';
import { AnalysisResult, PersRMConfig } from '../lib/persrm/types';

/**
 * Mock for optimization results
 */
interface OptimizationResult {
  success: boolean;
  overallScore?: number;
  maxScore?: number;
  issuesCount?: number;
  suggestionsCount?: number;
  reportPath?: string;
  error?: string;
}

// Define options interface
interface WatchOptions {
  mode: string;
  verbose: boolean;
  output: string;
  autoOptimize: boolean;
  saveOptimized: boolean;
  benchmark: boolean;
  sync: boolean;
  configFile?: string;
}

/**
 * Agent abstraction to handle both mock and real implementations
 */
interface PersRMAgentWrapper {
  analyze(componentPath: string): Promise<any>;
  analyzeDirectory(directoryPath: string): Promise<any[]>;
  optimize(componentPath: string): Promise<any>;
  getResults(): any[];
  saveResults(): any;
}

/**
 * Load the appropriate agent based on mode
 */
async function loadAgent(options: WatchOptions, workspacePath: string): Promise<PersRMAgentWrapper> {
  // Set environment variable based on options
  if (options.mode) {
    process.env.PERSRM_MODE = options.mode;
  }
  
  // Determine agent mode
  const agentMode = options.mode === 'prod' ? AgentMode.PROD : AgentMode.MOCK;
  
  try {
    // Load configuration if specified
    let config: PersRMConfig = {
      projectPath: workspacePath,
      outputDir: path.join(workspacePath, options.output),
      verbose: options.verbose,
      autoOptimize: options.autoOptimize
    };
    
    if (options.configFile && fs.existsSync(options.configFile)) {
      try {
        const fileConfig = await fs.readJSON(options.configFile);
        config = { ...config, ...fileConfig };
      } catch (error) {
        console.error(chalk.red(`Error loading config file: ${error.message}`));
      }
    }
    
    // Get the appropriate agent based on mode
    const agent = getActiveAgent(config, agentMode);
    
    // Create a wrapper to match the expected interface
    const agentWrapper: PersRMAgentWrapper = {
      analyze: async (componentPath: string) => {
        try {
          return await agent.analyze(componentPath);
        } catch (error) {
          console.error(chalk.red(`Analysis error: ${error.message}`));
          return null;
        }
      },
      
      analyzeDirectory: async (directoryPath: string) => {
        try {
          return await agent.analyzeDirectory(directoryPath);
        } catch (error) {
          console.error(chalk.red(`Directory analysis error: ${error.message}`));
          return [];
        }
      },
      
      optimize: async (componentPath: string) => {
        try {
          return await agent.optimize(componentPath);
        } catch (error) {
          console.error(chalk.red(`Optimization error: ${error.message}`));
          return null;
        }
      },
      
      getResults: () => agent.getResults(),
      
      saveResults: () => agent.saveResults()
    };
    
    return agentWrapper;
  } catch (error) {
    console.error(chalk.red(`Error loading agent: ${error.message}`));
    process.exit(1);
  }
}

// Get Git info for the current workspace
async function getGitInfo(workspacePath: string) {
  try {
    // This is a simple implementation; a real one would use a Git library
    const { execSync } = require('child_process');
    
    const commitSha = execSync('git rev-parse HEAD', { 
      cwd: workspacePath,
      encoding: 'utf-8'
    }).trim();
    
    const author = execSync('git log -1 --pretty=format:%an', {
      cwd: workspacePath, 
      encoding: 'utf-8'
    }).trim();
    
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: workspacePath,
      encoding: 'utf-8'
    }).trim();
    
    return { commitSha, author, branch };
  } catch (error) {
    // Git commands might fail if not in a Git repo
    return {};
  }
}

/**
 * Command-line script to watch for component changes and auto-optimize
 */
async function watchComponents(watchPath: string, options: WatchOptions) {
  // Get workspace path
  const workspacePath = process.cwd();
  const absoluteWatchPath = path.resolve(workspacePath, watchPath);
  
  console.log(chalk.blue('PersRM Component Watcher'));
  console.log(chalk.gray('---------------------------'));
  console.log(chalk.white(`Workspace: ${workspacePath}`));
  console.log(chalk.white(`Watching: ${absoluteWatchPath}`));
  console.log(chalk.white(`Output: ${options.output}`));
  console.log(chalk.white(`Mode: ${options.mode.toUpperCase() || process.env.PERSRM_MODE?.toUpperCase() || 'MOCK'}`));
  console.log(chalk.gray('---------------------------'));
  
  // Initialize agent with auto-optimization
  const agent = await loadAgent(options, workspacePath);
  
  // Ensure the watch directory exists
  try {
    await fs.ensureDir(absoluteWatchPath);
    console.log(chalk.gray(`Created watch directory: ${absoluteWatchPath}`));
  } catch (error: any) {
    console.error(chalk.red(`Could not create watch directory: ${error?.message || 'Unknown error'}`));
  }
  
  // Set up the watcher
  const watcher = chokidar.watch(absoluteWatchPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true
  });
  
  // Track the last optimization time to debounce rapid changes
  let lastOptimizationTime = 0;
  const DEBOUNCE_TIME = 2000; // 2 seconds
  
  // Listen for file changes
  watcher.on('change', async (filePath) => {
    const now = Date.now();
    const relativePath = path.relative(workspacePath, filePath);
    
    // Debounce optimizations
    if (now - lastOptimizationTime < DEBOUNCE_TIME) {
      console.log(chalk.yellow(`Change detected in ${relativePath} (debounced)`));
      return;
    }
    
    lastOptimizationTime = now;
    console.log(chalk.green(`Change detected in ${relativePath}`));
    
    if (options.autoOptimize) {
      console.log(chalk.white('Running optimization...'));
      
      try {
        // Analyze and optimize the component
        const analysis = await agent.analyze(filePath);
        if (!analysis) {
          console.log(chalk.red('Analysis failed.'));
          return;
        }
        
        const optimizationResult = await agent.optimize(filePath);
        
        // Get the agent's results to save
        agent.saveResults();
        
        // Add to benchmark if enabled
        if (options.benchmark) {
          try {
            const { BenchmarkTracker } = await import('../lib/benchmarks/BenchmarkTracker');
            const benchmarkTracker = new BenchmarkTracker();
            
            // Use Git info if available
            const gitInfo = await getGitInfo(workspacePath);
            
            benchmarkTracker.addEntry(analysis.summary, gitInfo);
            
            console.log(chalk.green('Added benchmark entry.'));
          } catch (error) {
            console.error(chalk.red(`Benchmark error: ${error.message}`));
          }
        }
        
        // Sync if enabled
        if (options.sync) {
          try {
            const { SyncManager } = await import('../lib/sync/SyncManager');
            const syncManager = new SyncManager({
              configPath: path.join(workspacePath, '.persrm-sync.json'),
              verbose: options.verbose
            });
            
            // Get Git info if available
            const gitInfo = await getGitInfo(workspacePath);
            
            await syncManager.syncEnhancementSummary(analysis.summary, {
              ...gitInfo,
              reportPath: path.join(workspacePath, options.output, 'latest-report.json')
            });
            
            console.log(chalk.green('Synced results to configured platforms'));
          } catch (error) {
            console.error(chalk.red(`Sync error: ${error.message}`));
          }
        }
        
        // Output results
        if (optimizationResult) {
          console.log(chalk.green(`Optimization completed successfully`));
          console.log(chalk.white(`Score: ${analysis.summary.overallScore}/${analysis.summary.maxScore}`));
          console.log(chalk.white(`Issues: ${analysis.summary.issues.length}`));
          console.log(chalk.white(`Suggestions: ${optimizationResult.suggestions.length}`));
        } else {
          console.log(chalk.red(`Optimization failed.`));
        }
        
        console.log(chalk.gray('---------------------------'));
      } catch (error: any) {
        console.error(chalk.red(`Error during optimization: ${error?.message || String(error) || 'Unknown error'}`));
        console.log(chalk.gray('---------------------------'));
      }
    } else {
      console.log(chalk.white('Auto-optimization is disabled. Use --auto-optimize to enable.'));
      console.log(chalk.gray('---------------------------'));
    }
  });

  // Listen for new files
  watcher.on('add', filePath => {
    const relativePath = path.relative(workspacePath, filePath);
    console.log(chalk.blue(`New file detected: ${relativePath}`));
  });
  
  // Handle errors
  watcher.on('error', (error: any) => {
    console.error(chalk.red(`Watcher error: ${error?.message || String(error)}`));
  });
  
  console.log(chalk.green('Watcher started successfully'));
  console.log(chalk.yellow('Press Ctrl+C to exit'));
  
  // Create a test file to trigger the watcher if no files exist
  setTimeout(async () => {
    const testFile = path.join(absoluteWatchPath, 'test-component.jsx');
    if (!(await fs.pathExists(testFile))) {
      console.log(chalk.gray('Creating a test component to demonstrate the watcher...'));
      await fs.writeFile(testFile, `
// Test Component
function TestComponent() {
  return (
    <div className="test-component">
      <h1>Test Component</h1>
      <p>This is a test component created by PersRM watcher</p>
    </div>
  );
}

export default TestComponent;
`);
      console.log(chalk.blue(`Created test file: ${path.relative(workspacePath, testFile)}`));
    }
  }, 1000);
}

// CLI entry point
const program = new Command();

program
  .name('persrm-watch')
  .description('Watch for component changes and analyze/optimize them')
  .argument('[path]', 'Directory to watch for changes', './src/components')
  .option('-m, --mode <mode>', 'Agent mode: "mock" or "prod"', process.env.PERSRM_MODE || 'mock')
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('-o, --output <dir>', 'Output directory for reports', 'persrm-output')
  .option('-a, --auto-optimize', 'Automatically optimize on changes', true)
  .option('-s, --save-optimized', 'Save optimized component files', false)
  .option('-b, --benchmark', 'Track benchmarks over time', true)
  .option('-y, --sync', 'Sync results to configured platforms', false)
  .option('-c, --config-file <path>', 'Path to config file')
  .action((watchPath, options) => {
    watchComponents(watchPath, options).catch((error: any) => {
      console.error(chalk.red(`Failed to start watcher: ${error?.message || String(error)}`));
      process.exit(1);
    });
  });

program.parse(); 