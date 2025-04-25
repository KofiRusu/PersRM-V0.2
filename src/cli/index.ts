#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { createWatcher } from '../lib/persrm/watcher';
import { PersRMConfig, AgentMode } from '../lib/persrm/types';

// Default configuration
const defaultConfig: PersRMConfig = {
  appName: 'My Application',
  version: '1.0.0',
  mode: AgentMode.ANALYSIS,
  outputDir: './persrm-reports',
  verbose: false
};

// Create program
const program = new Command();

program
  .name('persrm')
  .description('Personalized UX React Monitor for component analysis and enhancement')
  .version('1.0.0');

// Watch command
program
  .command('watch')
  .description('Start watching component files for UX issues')
  .option('-p, --paths <paths>', 'Comma-separated list of paths to watch', 'src')
  .option('-c, --config <configPath>', 'Path to PersRM config file')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-o, --output <outputDir>', 'Directory to save reports')
  .action((options) => {
    let config: PersRMConfig = { ...defaultConfig };
    
    // Load config from file if provided
    if (options.config) {
      try {
        const configPath = path.resolve(process.cwd(), options.config);
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config = { ...config, ...fileConfig };
      } catch (error) {
        console.error(`Error loading config file: ${error.message}`);
        process.exit(1);
      }
    }
    
    // Override with command line options
    if (options.verbose) {
      config.verbose = true;
    }
    
    if (options.output) {
      config.outputDir = options.output;
    }
    
    // Ensure output directory exists
    try {
      fs.mkdirSync(path.resolve(process.cwd(), config.outputDir), { recursive: true });
    } catch (error) {
      console.error(`Error creating output directory: ${error.message}`);
    }
    
    // Parse paths to watch
    const watchPaths = options.paths.split(',').map(p => path.resolve(process.cwd(), p.trim()));
    
    console.log(`Starting PersRM watcher with config:`, config);
    console.log(`Watching paths: ${watchPaths.join(', ')}`);
    
    // Create and start watcher
    const watcher = createWatcher(config, watchPaths);
    
    // Handle exit signals
    process.on('SIGINT', () => {
      console.log('\nReceived SIGINT. Shutting down...');
      watcher.stopWatching();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\nReceived SIGTERM. Shutting down...');
      watcher.stopWatching();
      process.exit(0);
    });
  });

// Analyze command (one-time analysis)
program
  .command('analyze')
  .description('Run one-time analysis on component files')
  .option('-t, --target <targetPath>', 'Path to analyze (file or directory)')
  .option('-c, --config <configPath>', 'Path to PersRM config file')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-o, --output <outputPath>', 'Path to save report')
  .action((options) => {
    console.log('One-time analysis not yet implemented');
    // This would be similar to the watch command but perform a one-time analysis
    // rather than continuous watching
  });

// Report command
program
  .command('report')
  .description('Generate or view UX enhancement reports')
  .option('-i, --input <inputPath>', 'Path to input data')
  .option('-o, --output <outputPath>', 'Path to save report')
  .option('-f, --format <format>', 'Report format (html, json, md)', 'html')
  .action((options) => {
    console.log('Report generation not yet implemented');
    // This would generate formatted reports from analysis data
  });

// Parse command line arguments
program.parse();

// If no arguments are provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 