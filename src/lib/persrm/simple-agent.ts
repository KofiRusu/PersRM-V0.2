import path from 'path';
import fs from 'fs-extra';
import { CommonAgentInterface } from './agent-switcher';
import { PersRMConfig } from './types';
// Replace glob import with a comment explaining we're using fs.readdir instead
// We're using fs.readdir instead of glob since it's a dependency we might not have

/**
 * Options for initializing the PersRM Agent
 */
export interface SimplePersRMConfig {
  projectPath: string;
  outputDir?: string;
  verbose?: boolean;
  takeScreenshots?: boolean;
  designSystemPath?: string;
  autoOptimize?: boolean;
  watchPath?: string;
}

/**
 * Result interface for agent operations
 */
export interface SimpleOperationResult {
  success: boolean;
  overallScore?: number;
  maxScore?: number;
  issuesCount?: number;
  suggestionsCount?: number;
  reportPath?: string;
  error?: string;
  summary?: any;
  suggestions?: any[];
  report?: string; // Add report property to fix type error
}

/**
 * A simplified PersRM Agent implementation that doesn't rely on external dependencies
 */
export class SimplePersRMAgent implements CommonAgentInterface {
  private config: PersRMConfig;
  private outputDir: string;
  private results: SimpleOperationResult[] = [];
  private lastResultPath: string = '';
  
  constructor(config: PersRMConfig) {
    this.config = config;
    this.outputDir = config.outputDir || path.join(config.projectPath, 'persrm-output');
    
    // Ensure output directory exists
    fs.ensureDirSync(this.outputDir);
    
    this.log(`Initialized SimplePersRMAgent for project: ${config.projectPath}`);
  }
  
  /**
   * Run UX analysis on a specific path
   */
  async analyze(targetPath: string): Promise<SimpleOperationResult> {
    this.log(`Starting analysis of: ${targetPath}`);
    
    try {
      // In a real implementation, we would analyze the actual project
      // Here we'll just create a mock result
      
      // Generate random scores
      const overallScore = Math.floor(Math.random() * 40) + 60; // 60-100
      const issuesCount = Math.floor(Math.random() * 15) + 5; // 5-20
      
      // Create a report file
      const timestamp = Date.now();
      const reportFile = `analysis-result-${timestamp}.json`;
      const reportPath = path.join(this.outputDir, reportFile);
      this.lastResultPath = reportPath;
      
      // Component or file name
      const componentName = path.basename(targetPath, path.extname(targetPath));
      
      // Create mock issues
      const issues = Array.from({ length: issuesCount }, (_, i) => ({
        id: `issue-${i}`,
        title: `Analysis Issue ${i}`,
        description: 'This is a mock issue found during analysis',
        severity: this.randomSeverity(),
        component: componentName
      }));
      
      // Create mock summary
      const summary = {
        id: `analysis-${timestamp}`,
        appName: path.basename(this.config.projectPath),
        componentName: componentName,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        duration: Math.floor(Math.random() * 500) + 100,
        overallScore,
        maxScore: 100,
        phases: [
          {
            phase: 'VISUAL_CONSISTENCY',
            score: Math.floor(Math.random() * 40) + 60,
            maxScore: 100,
            issues: []
          },
          {
            phase: 'ACCESSIBILITY',
            score: Math.floor(Math.random() * 40) + 60,
            maxScore: 100,
            issues: []
          }
        ],
        issues: issues.map(i => i.id)
      };
      
      // Create report data
      const reportData = {
        timestamp,
        summary,
        issues
      };
      
      // Save to results array
      const result = {
        success: true,
        overallScore,
        maxScore: 100,
        issuesCount,
        reportPath,
        summary
      };
      
      this.results.push(result);
      
      // Write report to file
      await fs.writeJSON(reportPath, reportData, { spaces: 2 });
      
      this.log(`Analysis completed successfully. Report saved to: ${reportPath}`);
      
      return result;
    } catch (error: any) {
      this.logError('Analysis failed', error);
      return {
        success: false,
        error: error?.message || String(error)
      };
    }
  }
  
  /**
   * Analyze a directory of components
   */
  async analyzeDirectory(dirPath: string): Promise<SimpleOperationResult[]> {
    this.log(`Analyzing directory: ${dirPath}`);
    
    try {
      // Use recursivelyFindFiles instead of glob.sync
      const files = this.recursivelyFindFiles(dirPath, ['.jsx', '.tsx', '.js', '.ts']);
      
      const results: SimpleOperationResult[] = [];
      
      // Analyze each file
      for (const file of files) {
        const result = await this.analyze(file);
        results.push(result);
      }
      
      return results;
    } catch (error: any) {
      this.logError(`Directory analysis failed: ${dirPath}`, error);
      return [{
        success: false,
        error: error?.message || String(error)
      }];
    }
  }
  
  /**
   * Recursively find files with specified extensions
   * This replaces the dependency on glob
   */
  private recursivelyFindFiles(dir: string, extensions: string[]): string[] {
    const result: string[] = [];
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Recursively search directories
          result.push(...this.recursivelyFindFiles(fullPath, extensions));
        } else if (
          stat.isFile() && 
          extensions.includes(path.extname(fullPath).toLowerCase())
        ) {
          result.push(fullPath);
        }
      }
    } catch (error) {
      this.log(`Error reading directory ${dir}: ${error}`);
    }
    
    return result;
  }
  
  /**
   * Run optimization on the project
   */
  async optimize(targetPath: string): Promise<SimpleOperationResult> {
    this.log(`Starting optimization of: ${targetPath}`);
    
    try {
      // In a real implementation, we would optimize the actual project
      // Here we'll just create a mock result
      
      // Generate random scores
      const overallScore = Math.floor(Math.random() * 40) + 60; // 60-100
      const issuesCount = Math.floor(Math.random() * 10) + 5; // 5-15
      const suggestionsCount = Math.floor(Math.random() * 5) + 3; // 3-8
      
      // Create a report file
      const timestamp = Date.now();
      const reportFile = `optimization-result-${timestamp}.json`;
      const reportPath = path.join(this.outputDir, reportFile);
      this.lastResultPath = reportPath;
      
      // Component or file name
      const componentName = path.basename(targetPath, path.extname(targetPath));
      
      // Create mock issues
      const issues = Array.from({ length: issuesCount }, (_, i) => ({
        id: `issue-${i}`,
        title: `Optimization Issue ${i}`,
        description: 'This is a mock issue found during optimization',
        severity: this.randomSeverity(),
        component: componentName
      }));
      
      // Create mock suggestions
      const suggestions = Array.from({ length: suggestionsCount }, (_, i) => ({
        id: `suggestion-${i}`,
        description: `Suggestion ${i}: Improve component structure`,
        impact: Math.floor(Math.random() * 100)
      }));
      
      // Create mock summary
      const summary = {
        id: `optimization-${timestamp}`,
        appName: path.basename(this.config.projectPath),
        componentName: componentName,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        duration: Math.floor(Math.random() * 500) + 100,
        overallScore,
        maxScore: 100,
        phases: [
          {
            phase: 'VISUAL_CONSISTENCY',
            score: Math.floor(Math.random() * 40) + 60,
            maxScore: 100,
            issues: []
          },
          {
            phase: 'ACCESSIBILITY',
            score: Math.floor(Math.random() * 40) + 60,
            maxScore: 100,
            issues: []
          }
        ],
        issues: issues.map(i => i.id)
      };
      
      // Create report data
      const reportData = {
        timestamp,
        summary,
        issues,
        suggestions
      };
      
      // Save to results array
      const result = {
        success: true,
        overallScore,
        maxScore: 100,
        issuesCount,
        suggestionsCount,
        reportPath,
        summary,
        suggestions
      };
      
      this.results.push(result);
      
      // Write report to file
      await fs.writeJSON(reportPath, reportData, { spaces: 2 });
      
      this.log(`Optimization completed successfully. Report saved to: ${reportPath}`);
      
      return result;
    } catch (error: any) {
      this.logError('Optimization failed', error);
      return {
        success: false,
        error: error?.message || String(error)
      };
    }
  }
  
  /**
   * Generate a report from a result file
   */
  async generateReportFromResult(resultPath: string, options: any): Promise<SimpleOperationResult> {
    this.log(`Generating report from: ${resultPath} with format: ${options.format}`);
    
    try {
      // Read the result file
      const resultData = await fs.readJSON(resultPath);
      
      // Generate a report based on the format
      const timestamp = Date.now();
      const format = options.format || 'html';
      const reportFile = `report-${timestamp}.${format}`;
      const reportPath = path.join(this.outputDir, reportFile);
      
      if (format === 'html') {
        await fs.writeFile(reportPath, `
          <!DOCTYPE html>
          <html>
            <head>
              <title>PersRM Report</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; }
                .score { font-size: 24px; font-weight: bold; color: green; }
                .issue { margin: 10px 0; padding: 10px; border: 1px solid #ccc; }
              </style>
            </head>
            <body>
              <h1>PersRM Analysis Report</h1>
              <p>Generated on ${new Date(timestamp).toLocaleString()}</p>
              <div class="score">Score: ${resultData.summary.overallScore}/${resultData.summary.maxScore}</div>
              <h2>Issues Found (${resultData.issues?.length || 0})</h2>
              ${(resultData.issues || []).map((issue: any) => `
                <div class="issue">
                  <h3>${issue.title}</h3>
                  <p>${issue.description}</p>
                  <p>Severity: ${issue.severity}</p>
                </div>
              `).join('')}
            </body>
          </html>
        `);
      } else if (format === 'md') {
        await fs.writeFile(reportPath, `
# PersRM Analysis Report

Generated on ${new Date(timestamp).toLocaleString()}

## Overall Score
**${resultData.summary.overallScore}/${resultData.summary.maxScore}**

## Issues Found (${resultData.issues?.length || 0})

${(resultData.issues || []).map((issue: any) => `
### ${issue.title}
${issue.description}
Severity: ${issue.severity}
`).join('')}
        `);
      } else {
        // JSON format - just copy the data
        await fs.writeJSON(reportPath, resultData, { spaces: 2 });
      }
      
      this.log(`Report generated successfully. Report saved to: ${reportPath}`);
      
      return {
        success: true,
        reportPath,
        report: reportPath
      };
    } catch (error: any) {
      this.logError('Report generation failed', error);
      return {
        success: false,
        error: error?.message || String(error)
      };
    }
  }
  
  /**
   * Save the latest results and return the path
   */
  saveResults(): string {
    if (this.lastResultPath) {
      this.log(`Results saved to: ${this.lastResultPath}`);
      return this.lastResultPath;
    }
    
    // If no specific result path, save a summary of all results
    const summaryPath = path.join(this.outputDir, `summary-${Date.now()}.json`);
    fs.writeJSONSync(summaryPath, {
      results: this.results,
      timestamp: new Date().toISOString()
    }, { spaces: 2 });
    
    this.log(`Results summary saved to: ${summaryPath}`);
    return summaryPath;
  }
  
  /**
   * Get all results
   */
  getResults(): SimpleOperationResult[] {
    return this.results;
  }
  
  /**
   * Utility to generate a random severity level
   */
  private randomSeverity(): string {
    const levels = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'];
    const weights = [5, 3, 2, 1]; // Make lower severities more common
    
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * total;
    
    let sum = 0;
    for (let i = 0; i < levels.length; i++) {
      sum += weights[i];
      if (random < sum) {
        return levels[i];
      }
    }
    
    return 'INFO';
  }
  
  /**
   * Log a message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[SimplePersRMAgent] ${message}`);
    }
  }
  
  /**
   * Log an error message
   */
  private logError(message: string, error: any): void {
    console.error(`[SimplePersRMAgent] ERROR: ${message}: ${error?.message || String(error)}`);
  }
  
  /**
   * Get the current output directory
   */
  getOutputPath(): string {
    return this.outputDir;
  }
} 