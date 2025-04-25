#!/usr/bin/env node

import { program } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ComponentWatcher } from '../lib/persrm/watcher';
import { PersRMConfig, UXEnhancementSummary, AgentMode as TypesAgentMode } from '../lib/persrm/types';
import { AgentMode as SwitcherAgentMode } from '../lib/persrm/agent-switcher';

// Create a mapping between the two AgentMode enums
function mapAgentMode(mode: SwitcherAgentMode): TypesAgentMode {
  // Map agent-switcher's AgentMode to types.ts AgentMode
  switch (mode) {
    case SwitcherAgentMode.MOCK:
      return TypesAgentMode.ANALYSIS;
    case SwitcherAgentMode.PROD:
      return TypesAgentMode.OPTIMIZATION;
    default:
      return TypesAgentMode.ANALYSIS; // Default fallback
  }
}

// Extended configuration that includes CLI-specific properties
interface ExtendedPersRMConfig {
  projectPath: string;
  outputDir: string;
  appName?: string;
  version?: string;
  outputPath?: string;
  analyzeExisting?: boolean;
  rootPath?: string;
  mode: SwitcherAgentMode;
  verbose?: boolean;
}

// Default configuration
const defaultConfig: ExtendedPersRMConfig = {
  projectPath: process.cwd(),
  outputDir: './persrm-reports',
  mode: SwitcherAgentMode.MOCK,
  verbose: false,
  appName: '',
  version: '1.0.0',
  analyzeExisting: true,
  outputPath: './persrm-reports'
};

/**
 * Load configuration from package.json or .persrmrc.json
 */
function loadConfig(): ExtendedPersRMConfig {
  const config: ExtendedPersRMConfig = { ...defaultConfig };
  
  // Try to load from package.json
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      
      if (pkg.persrm) {
        Object.assign(config, pkg.persrm);
      }
      
      // If no app name specified, use the package name
      if (!config.appName && pkg.name) {
        config.appName = pkg.name;
      }
      
      // If no version specified, use the package version
      if (config.version === defaultConfig.version && pkg.version) {
        config.version = pkg.version;
      }
    }
  } catch (error) {
    console.warn('Error loading config from package.json:', error);
  }
  
  // Try to load from .persrmrc.json (overrides package.json)
  try {
    const rcPath = path.resolve(process.cwd(), '.persrmrc.json');
    if (fs.existsSync(rcPath)) {
      const rcConfig = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
      Object.assign(config, rcConfig);
    }
  } catch (error) {
    console.warn('Error loading config from .persrmrc.json:', error);
  }
  
  return config;
}

/**
 * Save analysis results to disk
 */
function saveResults(result: UXEnhancementSummary, config: ExtendedPersRMConfig): void {
  // Guarantee that outputPath is a string
  const outputDir = config.outputPath || defaultConfig.outputPath;
  if (!outputDir) {
    throw new Error("Output path is not defined");
  }
  
  const outputPath = path.resolve(process.cwd(), outputDir);
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  // Create a filename based on the component and timestamp
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `${result.id}_${timestamp}.json`;
  const filePath = path.join(outputPath, filename);
  
  // Write the results to disk
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  
  console.log(`Analysis results saved to: ${filePath}`);
}

// Main CLI program
program
  .name('persrm')
  .description('PersRM - UX enhancement and analysis tool')
  .version('0.1.0');

program
  .command('analyze')
  .description('Analyze components for UX issues')
  .argument('[paths...]', 'Glob patterns for component files to analyze')
  .option('-w, --watch', 'Watch for file changes')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-o, --output <path>', 'Output path for analysis results')
  .option('-e, --existing', 'Analyze existing files when in watch mode', true)
  .option('--mock', 'Use mock data for analysis (default)', true)
  .action((paths, options) => {
    // Load config and override with command line options
    const config = loadConfig();
    
    if (options.verbose) {
      config.verbose = true;
    }
    
    if (options.output) {
      config.outputPath = options.output;
    }
    
    if (options.existing !== undefined) {
      config.analyzeExisting = options.existing;
    }
    
    // Default paths if none provided
    if (!paths || paths.length === 0) {
      paths = ['src/**/*.tsx', 'src/**/*.jsx', 'components/**/*.tsx', 'components/**/*.jsx'];
    }
    
    // Log configuration
    console.log('PersRM Analyzer');
    console.log('==============');
    console.log(`App: ${config.appName || 'Unknown'} v${config.version}`);
    console.log(`Watching: ${options.watch ? 'Yes' : 'No'}`);
    console.log(`Paths: ${paths.join(', ')}`);
    console.log(`Output: ${config.outputPath}`);
    console.log('==============\n');
    
    // Create a properly mapped configuration for ComponentWatcher
    const watcherConfig: PersRMConfig = {
      projectPath: config.projectPath,
      outputDir: config.outputDir,
      // Map to the correct AgentMode enum type
      mode: mapAgentMode(config.mode),
      verbose: config.verbose ?? false
    };
    
    // Create component watcher
    const watcher = new ComponentWatcher(watcherConfig);
    
    // Handle analysis results
    const handleResults = (result: UXEnhancementSummary) => {
      // Display a summary of the results
      console.log(`\nAnalysis of ${result.id} complete`);
      console.log(`Overall score: ${result.overallScore}/${result.maxScore}`);
      console.log(`Issues found: ${result.issues.length}`);
      
      // Group by severity
      const bySeverity = result.issues.reduce((acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('Issues by severity:', bySeverity);
      
      // Save results to disk
      saveResults(result, config);
    };
    
    if (options.watch) {
      // Start watching for changes
      watcher.start(paths, handleResults);
      
      console.log('Watching for file changes...');
      
      // Setup clean exit on CTRL+C
      process.on('SIGINT', () => {
        console.log('\nStopping watcher...');
        watcher.stop();
        process.exit(0);
      });
    } else {
      // Just analyze without watching
      console.log('One-time analysis not implemented yet. Try --watch mode.');
      process.exit(0);
    }
  });

program.parse(process.argv); 