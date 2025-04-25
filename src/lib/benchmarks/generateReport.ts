#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import { BenchmarkTracker, BenchmarkEntry } from './BenchmarkTracker';
import { PhaseType } from '../persrm/types';

interface ReportOptions {
  format: 'html' | 'json' | 'md';
  outputPath: string;
  limit?: number;
  componentName?: string;
  includeIssues: boolean;
  includeTrends: boolean;
}

/**
 * Generate a benchmark report in the specified format
 */
async function generateBenchmarkReport(options: ReportOptions): Promise<string> {
  const tracker = new BenchmarkTracker();
  const entries = tracker.getEntries();
  
  if (entries.length === 0) {
    throw new Error('No benchmark data available. Run UX analysis first.');
  }
  
  // Apply filtering
  let filteredEntries = [...entries];
  
  if (options.componentName) {
    filteredEntries = filteredEntries.filter(
      entry => entry.summary.componentName === options.componentName
    );
    
    if (filteredEntries.length === 0) {
      throw new Error(`No benchmark data found for component: ${options.componentName}`);
    }
  }
  
  // Sort by timestamp (newest first)
  filteredEntries.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  // Apply limit
  if (options.limit && options.limit > 0) {
    filteredEntries = filteredEntries.slice(0, options.limit);
  }
  
  // Generate the report based on format
  let reportContent = '';
  let outputFilePath = '';
  
  switch (options.format) {
    case 'html':
      reportContent = generateHtmlReport(filteredEntries, options);
      outputFilePath = path.join(options.outputPath, 'benchmark-report.html');
      break;
    case 'json':
      reportContent = JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          totalEntries: entries.length,
          filteredEntries: filteredEntries.length,
          entries: filteredEntries,
          trends: options.includeTrends ? generateTrendsData(filteredEntries) : undefined
        }, 
        null, 
        2
      );
      outputFilePath = path.join(options.outputPath, 'benchmark-report.json');
      break;
    case 'md':
      reportContent = generateMarkdownReport(filteredEntries, options);
      outputFilePath = path.join(options.outputPath, 'benchmark-report.md');
      break;
  }
  
  // Ensure output directory exists
  fs.ensureDirSync(options.outputPath);
  
  // Write report to file
  await fs.writeFile(outputFilePath, reportContent);
  
  return outputFilePath;
}

/**
 * Generate trends data for charting
 */
function generateTrendsData(entries: BenchmarkEntry[]) {
  // Sort by timestamp (oldest first)
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // Extract data points
  const timestamps = sortedEntries.map(entry => 
    new Date(entry.timestamp).toLocaleDateString()
  );
  
  const overallScores = sortedEntries.map(entry => entry.summary.overallScore);
  
  // Extract phase scores (if available)
  const phaseScores: Record<PhaseType, number[]> = {} as Record<PhaseType, number[]>;
  
  Object.values(PhaseType).forEach(phase => {
    phaseScores[phase] = sortedEntries.map(entry => {
      const phaseScore = entry.summary.phases.find(p => p.phase === phase);
      return phaseScore ? phaseScore.score : 0;
    });
  });
  
  // Issue counts
  const issueCounts = sortedEntries.map(entry => entry.summary.issues.length);
  
  return {
    timestamps,
    overallScores,
    phaseScores,
    issueCounts
  };
}

/**
 * Generate an HTML report
 */
function generateHtmlReport(entries: BenchmarkEntry[], options: ReportOptions): string {
  const trends = options.includeTrends ? generateTrendsData(entries) : null;
  
  // CSS for styling
  const styles = `
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #333; line-height: 1.5; }
    h1, h2, h3 { color: #0066cc; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    .summary { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
    .summary-card { background: white; border: 1px solid #ddd; border-radius: 5px; padding: 15px; flex: 1; min-width: 200px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .chart-container { width: 100%; height: 400px; margin-bottom: 30px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f5f5f5; font-weight: bold; }
    tr:hover { background-color: #f9f9f9; }
    .score { font-weight: bold; }
    .good { color: #4caf50; }
    .warning { color: #ff9800; }
    .poor { color: #f44336; }
    .issues-list { list-style-type: none; padding: 0; }
    .issues-list li { padding: 8px; border-left: 3px solid #ddd; margin-bottom: 6px; }
    .severity-critical { border-left-color: #f44336; }
    .severity-error { border-left-color: #ff9800; }
    .severity-warning { border-left-color: #ffeb3b; }
    .severity-info { border-left-color: #2196f3; }
  `;
  
  // Script for charts (using Chart.js)
  const scripts = trends ? `
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        // Overall Score Trend
        const scoreCtx = document.getElementById('scoreChart').getContext('2d');
        new Chart(scoreCtx, {
          type: 'line',
          data: {
            labels: ${JSON.stringify(trends.timestamps)},
            datasets: [{
              label: 'Overall Score',
              data: ${JSON.stringify(trends.overallScores)},
              borderColor: '#0066cc',
              backgroundColor: 'rgba(0, 102, 204, 0.1)',
              borderWidth: 2,
              tension: 0.1,
              fill: true
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Overall Score Trend'
              }
            },
            scales: {
              y: {
                min: 0,
                max: 100
              }
            }
          }
        });
        
        // Issues Count Chart
        const issuesCtx = document.getElementById('issuesChart').getContext('2d');
        new Chart(issuesCtx, {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(trends.timestamps)},
            datasets: [{
              label: 'Issues Count',
              data: ${JSON.stringify(trends.issueCounts)},
              backgroundColor: 'rgba(255, 99, 132, 0.7)'
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Issues Count Trend'
              }
            }
          }
        });
        
        // Phase Scores Chart
        const phaseCtx = document.getElementById('phaseChart').getContext('2d');
        new Chart(phaseCtx, {
          type: 'radar',
          data: {
            labels: Object.keys(${JSON.stringify(trends.phaseScores)}),
            datasets: ${JSON.stringify(Object.keys(trends.phaseScores).map((phase, index) => ({
              label: phase,
              data: trends.phaseScores[phase as PhaseType].map(score => score || 0),
              borderColor: getColorForIndex(index),
              backgroundColor: getBackgroundColorForIndex(index)
            })))}
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Phase Scores'
              }
            },
            scales: {
              r: {
                min: 0,
                max: 100
              }
            }
          }
        });
        
        function getColorForIndex(index) {
          const colors = [
            '#0066cc', '#ff9800', '#4caf50', '#f44336', '#9c27b0', '#795548'
          ];
          return colors[index % colors.length];
        }
        
        function getBackgroundColorForIndex(index) {
          const colors = [
            'rgba(0, 102, 204, 0.2)',
            'rgba(255, 152, 0, 0.2)',
            'rgba(76, 175, 80, 0.2)',
            'rgba(244, 67, 54, 0.2)',
            'rgba(156, 39, 176, 0.2)',
            'rgba(121, 85, 72, 0.2)'
          ];
          return colors[index % colors.length];
        }
      });
    </script>
  ` : '';
  
  // Generate entry rows for the benchmark table
  const entryRows = entries.map(entry => {
    const scoreClass = 
      entry.summary.overallScore >= 80 ? 'good' : 
      entry.summary.overallScore >= 60 ? 'warning' : 'poor';
    
    return `
      <tr>
        <td>${new Date(entry.timestamp).toLocaleString()}</td>
        <td>${entry.summary.componentName || 'Unknown'}</td>
        <td class="score ${scoreClass}">${entry.summary.overallScore}/${entry.summary.maxScore}</td>
        <td>${entry.summary.issues.length}</td>
        <td>${entry.commitSha ? entry.commitSha.substring(0, 7) : 'N/A'}</td>
        <td>${entry.author || 'N/A'}</td>
      </tr>
    `;
  }).join('');
  
  // Generate issues list if requested
  let issuesSection = '';
  if (options.includeIssues && entries.length > 0) {
    const latestEntry = entries[0];
    const issueItems = latestEntry.summary.issues.map(issue => {
      const severityClass = `severity-${issue.severity.toLowerCase()}`;
      return `
        <li class="${severityClass}">
          <strong>${issue.component}</strong>: ${issue.message}
          <br>
          <small>Severity: ${issue.severity}, Impact: ${issue.impact}</small>
        </li>
      `;
    }).join('');
    
    issuesSection = `
      <h2>Latest Issues (${latestEntry.summary.componentName || 'Latest Entry'})</h2>
      <ul class="issues-list">
        ${issueItems}
      </ul>
    `;
  }
  
  // Charts section
  const chartsSection = trends ? `
    <h2>Performance Trends</h2>
    <div class="chart-container">
      <canvas id="scoreChart"></canvas>
    </div>
    <div class="chart-container">
      <canvas id="issuesChart"></canvas>
    </div>
    <div class="chart-container">
      <canvas id="phaseChart"></canvas>
    </div>
  ` : '';
  
  // Assemble the full HTML
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PersRM Benchmark Report</title>
      <style>${styles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>PersRM Benchmark Report</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          ${options.componentName ? `<p>Component: ${options.componentName}</p>` : ''}
        </div>
        
        <div class="summary">
          <div class="summary-card">
            <h3>Benchmarks</h3>
            <p>Total: ${entries.length}</p>
          </div>
          ${entries.length > 0 ? `
            <div class="summary-card">
              <h3>Latest Score</h3>
              <p class="score ${entries[0].summary.overallScore >= 80 ? 'good' : entries[0].summary.overallScore >= 60 ? 'warning' : 'poor'}">
                ${entries[0].summary.overallScore}/${entries[0].summary.maxScore}
              </p>
            </div>
            <div class="summary-card">
              <h3>Issues</h3>
              <p>${entries[0].summary.issues.length} issues found</p>
            </div>
          ` : ''}
        </div>
        
        ${chartsSection}
        
        <h2>Benchmark History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Component</th>
              <th>Score</th>
              <th>Issues</th>
              <th>Commit</th>
              <th>Author</th>
            </tr>
          </thead>
          <tbody>
            ${entryRows}
          </tbody>
        </table>
        
        ${issuesSection}
      </div>
      ${scripts}
    </body>
    </html>
  `;
}

/**
 * Generate a Markdown report
 */
function generateMarkdownReport(entries: BenchmarkEntry[], options: ReportOptions): string {
  const header = `# PersRM Benchmark Report\n\nGenerated on ${new Date().toLocaleString()}\n`;
  
  let componentSection = '';
  if (options.componentName) {
    componentSection = `\n## Component: ${options.componentName}\n`;
  }
  
  let summarySection = '';
  if (entries.length > 0) {
    const latestEntry = entries[0];
    summarySection = `
## Summary

- **Latest Score**: ${latestEntry.summary.overallScore}/${latestEntry.summary.maxScore}
- **Issues**: ${latestEntry.summary.issues.length} issues found
- **Date**: ${new Date(latestEntry.timestamp).toLocaleString()}
${latestEntry.commitSha ? `- **Commit**: ${latestEntry.commitSha}\n` : ''}
${latestEntry.author ? `- **Author**: ${latestEntry.author}\n` : ''}
`;
  }
  
  const tableHeader = `
## Benchmark History

| Date | Component | Score | Issues | Commit | Author |
|------|-----------|-------|--------|--------|--------|
`;
  
  const tableRows = entries.map(entry => {
    return `| ${new Date(entry.timestamp).toLocaleString()} | ${entry.summary.componentName || 'Unknown'} | ${entry.summary.overallScore}/${entry.summary.maxScore} | ${entry.summary.issues.length} | ${entry.commitSha ? entry.commitSha.substring(0, 7) : 'N/A'} | ${entry.author || 'N/A'} |`;
  }).join('\n');
  
  let issuesSection = '';
  if (options.includeIssues && entries.length > 0) {
    const latestEntry = entries[0];
    issuesSection = `
## Latest Issues (${latestEntry.summary.componentName || 'Latest Entry'})

${latestEntry.summary.issues.map(issue => {
  return `- **${issue.component}**: ${issue.message}\n  - Severity: ${issue.severity}, Impact: ${issue.impact}`;
}).join('\n')}
`;
  }
  
  return `${header}${componentSection}${summarySection}${tableHeader}${tableRows}\n${issuesSection}`;
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const program = new Command();
  
  program
    .name('persrm-benchmark')
    .description('Generate reports from PersRM benchmark history')
    .option('-f, --format <format>', 'Report format (html, json, md)', 'html')
    .option('-o, --output <path>', 'Output directory', './persrm-reports')
    .option('-l, --limit <number>', 'Limit number of benchmark entries')
    .option('-c, --component <name>', 'Filter by component name')
    .option('-i, --issues', 'Include detailed issues', false)
    .option('-t, --trends', 'Include trend charts (HTML only)', true)
    .action(async (options) => {
      try {
        const reportPath = await generateBenchmarkReport({
          format: options.format as 'html' | 'json' | 'md',
          outputPath: options.output,
          limit: options.limit ? parseInt(options.limit) : undefined,
          componentName: options.component,
          includeIssues: options.issues,
          includeTrends: options.trends
        });
        
        console.log(chalk.green(`Benchmark report generated successfully at: ${reportPath}`));
      } catch (error) {
        console.error(chalk.red('Error generating benchmark report:'), error);
        process.exit(1);
      }
    });
  
  program.parse();
}

export { generateBenchmarkReport }; 