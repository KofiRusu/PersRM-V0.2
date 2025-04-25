#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { UXAnalyzer } from './analyzer';
import { UXOptimizer } from './optimizer';
import { PersRMConfig } from './types';

const defaultConfig: PersRMConfig = {
  appName: 'PersLM Application',
  version: '1.0.0',
  verbose: false,
  outputPath: './persrm-reports',
  saveOptimized: false
};

/**
 * Load configuration from package.json or .persrmrc file
 */
async function loadConfig(configPath?: string): Promise<PersRMConfig> {
  const config = { ...defaultConfig };
  
  // Load from specified config file
  if (configPath && await fs.pathExists(configPath)) {
    try {
      const fileConfig = await fs.readJSON(configPath);
      Object.assign(config, fileConfig);
    } catch (error) {
      console.error(`Error loading config from ${configPath}:`, error);
    }
  }
  
  // Load from package.json
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (await fs.pathExists(pkgPath)) {
    try {
      const pkg = await fs.readJSON(pkgPath);
      if (pkg.persrm) {
        Object.assign(config, pkg.persrm);
      }
      
      // Use package name and version if not specified
      if (!config.appName && pkg.name) {
        config.appName = pkg.name;
      }
      if (config.version === defaultConfig.version && pkg.version) {
        config.version = pkg.version;
      }
    } catch (error) {
      console.error('Error loading config from package.json:', error);
    }
  }
  
  return config;
}

/**
 * PersRM CLI entry point
 */
export async function runCLI(): Promise<void> {
  const program = new Command();
  
  program
    .name('persrm')
    .description('PersRM - UI/UX Performance Analysis and Optimization')
    .version('0.1.0');
    
  /**
   * Analyze command
   */
  program
    .command('analyze')
    .description('Analyze components for UX issues')
    .argument('<path>', 'Path to component file or directory')
    .option('-o, --output <dir>', 'Output directory for reports')
    .option('-v, --verbose', 'Enable verbose output')
    .option('-c, --config <path>', 'Path to config file')
    .action(async (targetPath, options) => {
      // Load config and apply CLI options
      const config = await loadConfig(options.config);
      
      if (options.verbose) {
        config.verbose = true;
      }
      
      if (options.output) {
        config.outputPath = options.output;
      }
      
      console.log(chalk.blue('PersRM Analysis'));
      console.log(chalk.gray('=============='));
      console.log(`Target: ${targetPath}`);
      console.log(`Output: ${config.outputPath}`);
      console.log(chalk.gray('=============='));
      
      try {
        const analyzer = new UXAnalyzer(config);
        let results;
        
        const targetAbsPath = path.resolve(process.cwd(), targetPath);
        const isDirectory = (await fs.stat(targetAbsPath)).isDirectory();
        
        if (isDirectory) {
          console.log(chalk.white(`Analyzing directory: ${targetPath}`));
          results = await analyzer.analyzeDirectory(targetAbsPath);
          console.log(chalk.green(`Analyzed ${results.length} components`));
        } else {
          console.log(chalk.white(`Analyzing component: ${path.basename(targetPath)}`));
          results = [await analyzer.analyze(targetAbsPath)];
          console.log(chalk.green('Analysis complete'));
        }
        
        analyzer.saveResults();
        
        // Print summary
        const scores = results.map(r => r.summary.overallScore);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const issueCount = results.reduce((count, r) => count + r.summary.issues.length, 0);
        
        console.log(chalk.white(`\nSummary:`));
        console.log(chalk.white(`- Components analyzed: ${results.length}`));
        console.log(chalk.white(`- Average score: ${avgScore.toFixed(1)}/100`));
        console.log(chalk.white(`- Total issues: ${issueCount}`));
        console.log(chalk.white(`- Results saved to: ${config.outputPath}`));
      } catch (error) {
        console.error(chalk.red('Analysis failed:'), error);
        process.exit(1);
      }
    });
    
  /**
   * Optimize command
   */
  program
    .command('optimize')
    .description('Optimize components based on analysis')
    .argument('<path>', 'Path to component file or directory')
    .option('-o, --output <dir>', 'Output directory for reports')
    .option('-v, --verbose', 'Enable verbose output')
    .option('-c, --config <path>', 'Path to config file')
    .option('-s, --save', 'Save optimized files')
    .action(async (targetPath, options) => {
      // Load config and apply CLI options
      const config = await loadConfig(options.config);
      
      if (options.verbose) {
        config.verbose = true;
      }
      
      if (options.output) {
        config.outputPath = options.output;
      }
      
      if (options.save) {
        config.saveOptimized = true;
      }
      
      console.log(chalk.blue('PersRM Optimization'));
      console.log(chalk.gray('=============='));
      console.log(`Target: ${targetPath}`);
      console.log(`Output: ${config.outputPath}`);
      console.log(`Save optimized files: ${config.saveOptimized ? 'Yes' : 'No'}`);
      console.log(chalk.gray('=============='));
      
      try {
        const analyzer = new UXAnalyzer(config);
        const optimizer = new UXOptimizer(config);
        let analysisResults;
        
        const targetAbsPath = path.resolve(process.cwd(), targetPath);
        const isDirectory = (await fs.stat(targetAbsPath)).isDirectory();
        
        // First analyze
        if (isDirectory) {
          console.log(chalk.white(`Analyzing directory: ${targetPath}`));
          analysisResults = await analyzer.analyzeDirectory(targetAbsPath);
        } else {
          console.log(chalk.white(`Analyzing component: ${path.basename(targetPath)}`));
          analysisResults = [await analyzer.analyze(targetAbsPath)];
        }
        
        // Then optimize
        console.log(chalk.white(`Optimizing ${analysisResults.length} components...`));
        const optimizationResults = await optimizer.optimizeMultiple(analysisResults);
        
        // Print summary
        console.log(chalk.green(`\nOptimization complete`));
        console.log(chalk.white(`\nSummary:`));
        console.log(chalk.white(`- Components optimized: ${optimizationResults.length}`));
        
        const suggestionCount = optimizationResults.reduce(
          (count, r) => count + r.suggestions.length, 
          0
        );
        
        console.log(chalk.white(`- Total suggestions: ${suggestionCount}`));
        
        if (config.saveOptimized) {
          console.log(chalk.white(`- Optimized files saved with .optimized extension`));
        }
      } catch (error) {
        console.error(chalk.red('Optimization failed:'), error);
        process.exit(1);
      }
    });
    
  /**
   * Report command
   */
  program
    .command('report')
    .description('Generate HTML, Markdown or JSON reports from analysis')
    .option('-i, --input <dir>', 'Input directory containing analysis results', defaultConfig.outputPath)
    .option('-o, --output <dir>', 'Output directory for reports')
    .option('-f, --format <format>', 'Report format (html, md, json)', 'html')
    .option('-v, --verbose', 'Enable verbose output')
    .action(async (options) => {
      console.log(chalk.blue('PersRM Report Generation'));
      console.log(chalk.gray('=============='));
      console.log(`Format: ${options.format}`);
      console.log(`Input: ${options.input}`);
      console.log(`Output: ${options.output || options.input}`);
      console.log(chalk.gray('=============='));
      
      // Simple mock implementation for now
      console.log(chalk.yellow('Report generation is not fully implemented yet.'));
      console.log(chalk.white('This would generate a formatted report from analysis data.'));
    });
  
  // Parse command line arguments
  await program.parseAsync();
}

// Run CLI if called directly
if (require.main === module) {
  runCLI().catch(error => {
    console.error('Error running CLI:', error);
    process.exit(1);
  });
} 