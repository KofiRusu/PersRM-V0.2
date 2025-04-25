#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { program } = require('commander');
const chalk = require('chalk');

const LOG_DIR = path.join(process.cwd(), 'logs');
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'ab-test-results');

// Define CLI options
program
  .description('Analyze A/B test logs to determine the best animation variant')
  .option('-s, --since <date>', 'Analyze data since date (YYYY-MM-DD)', getDefaultStartDate())
  .option('-u, --until <date>', 'Analyze data until date (YYYY-MM-DD)', getTomorrowDate())
  .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT_DIR)
  .option('-v, --variants <variants>', 'Comma-separated list of variants to analyze', 'slide-in,fade-in,scale')
  .option('-m, --metrics <metrics>', 'Metrics to analyze (engagement,duration,completion)', 'engagement,duration,completion')
  .parse(process.argv);

const options = program.opts();

/**
 * Get default start date (30 days ago)
 */
function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

/**
 * Get tomorrow's date
 */
function getTomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

/**
 * Initialize output directory
 */
function initOutputDir(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(chalk.blue(`Created output directory at ${outputDir}`));
  }
}

/**
 * Get list of log files in date range
 */
function getLogFiles(since, until) {
  if (!fs.existsSync(LOG_DIR)) {
    console.error(chalk.red(`Log directory not found: ${LOG_DIR}`));
    return [];
  }

  // Get all log files
  const files = fs.readdirSync(LOG_DIR)
    .filter(file => (file.startsWith('reasoning-log-') || file.startsWith('session-log-')) && file.endsWith('.jsonl'))
    .sort();

  // Filter by date range if specified
  const sinceDate = new Date(since);
  const untilDate = new Date(until);

  return files.filter(file => {
    // Extract date from filename (reasoning-log-YYYY-MM-DD.jsonl or session-log-YYYY-MM-DD.jsonl)
    const datePart = file.replace(/^(reasoning|session)-log-/, '').replace('.jsonl', '');
    const fileDate = new Date(datePart);
    return fileDate >= sinceDate && fileDate <= untilDate;
  }).map(file => path.join(LOG_DIR, file));
}

/**
 * Process log files and extract A/B test data
 */
async function processLogFiles(files, variants) {
  const variantData = {};
  const sessions = {};
  const completionRates = {};
  
  // Initialize variant data
  variants.forEach(variant => {
    variantData[variant] = {
      impressions: 0,
      engagements: 0,
      totalDuration: 0,
      completions: 0,
      queries: [],
      averageQueriesPerSession: 0,
      sessionsWithCompletion: 0
    };
    completionRates[variant] = [];
  });

  for (const file of files) {
    console.log(chalk.blue(`Processing ${path.basename(file)}...`));
    
    const fileStream = fs.createReadStream(file);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    // Process each line (JSON record)
    for await (const line of rl) {
      try {
        const record = JSON.parse(line);
        
        // Skip records without variant information
        if (!record.variant || !variants.includes(record.variant)) {
          continue;
        }
        
        const variant = record.variant;
        
        // Track session data
        if (record.sessionId) {
          if (!sessions[record.sessionId]) {
            sessions[record.sessionId] = {
              variant,
              startTime: record.timestamp,
              endTime: record.timestamp,
              queries: 0,
              completed: false
            };
            variantData[variant].impressions++;
          } else {
            // Update session end time if this record is newer
            if (new Date(record.timestamp) > new Date(sessions[record.sessionId].endTime)) {
              sessions[record.sessionId].endTime = record.timestamp;
            }
          }
          
          // Count queries in session
          if (record.type === 'reasoning' || record.type === 'codegen' || record.type === 'route') {
            sessions[record.sessionId].queries++;
            variantData[variant].queries.push(record);
          }
          
          // Track engagements (user interaction)
          if (record.event === 'interaction' || record.type === 'reasoning') {
            variantData[variant].engagements++;
          }
          
          // Track completion (user successfully generated something)
          if (record.event === 'completion' || 
              (record.type === 'reasoning' && !record.error) || 
              (record.type === 'codegen' && !record.error)) {
            sessions[record.sessionId].completed = true;
            variantData[variant].completions++;
          }
        }
      } catch (error) {
        console.error(chalk.red(`Error parsing line: ${error.message}`));
      }
    }
  }
  
  // Calculate additional metrics
  Object.keys(variantData).forEach(variant => {
    // Calculate session durations
    let totalSessionDuration = 0;
    let sessionCount = 0;
    let completedSessionCount = 0;
    
    Object.values(sessions).forEach(session => {
      if (session.variant === variant) {
        const startTime = new Date(session.startTime);
        const endTime = new Date(session.endTime);
        const duration = (endTime - startTime) / 1000; // in seconds
        
        totalSessionDuration += duration;
        sessionCount++;
        
        if (session.completed) {
          completedSessionCount++;
          completionRates[variant].push(session.queries > 0 ? 1 : 0);
        } else {
          completionRates[variant].push(0);
        }
      }
    });
    
    variantData[variant].totalDuration = totalSessionDuration;
    variantData[variant].averageSessionDuration = sessionCount > 0 ? totalSessionDuration / sessionCount : 0;
    variantData[variant].sessionsWithCompletion = completedSessionCount;
    variantData[variant].averageQueriesPerSession = sessionCount > 0 ? 
      variantData[variant].queries.length / sessionCount : 0;
  });
  
  return { variantData, completionRates };
}

/**
 * Calculate statistical significance using chi-square test
 * For comparing conversion rates between variants
 */
function calculateChiSquare(variantA, variantB, variantData) {
  const dataA = variantData[variantA];
  const dataB = variantData[variantB];
  
  // Need minimum sample size
  if (dataA.impressions < 30 || dataB.impressions < 30) {
    return {
      significant: false,
      pValue: 1,
      chiSquare: 0,
      message: 'Insufficient sample size (need at least 30 impressions per variant)'
    };
  }
  
  // Observed values
  const observedSuccessA = dataA.completions;
  const observedFailureA = dataA.impressions - dataA.completions;
  const observedSuccessB = dataB.completions;
  const observedFailureB = dataB.impressions - dataB.completions;
  
  // Expected values (based on overall conversion rate)
  const totalImpressions = dataA.impressions + dataB.impressions;
  const totalCompletions = observedSuccessA + observedSuccessB;
  const overallConversionRate = totalCompletions / totalImpressions;
  
  const expectedSuccessA = dataA.impressions * overallConversionRate;
  const expectedFailureA = dataA.impressions * (1 - overallConversionRate);
  const expectedSuccessB = dataB.impressions * overallConversionRate;
  const expectedFailureB = dataB.impressions * (1 - overallConversionRate);
  
  // Calculate chi-square
  const chiSquare = 
    Math.pow(observedSuccessA - expectedSuccessA, 2) / expectedSuccessA +
    Math.pow(observedFailureA - expectedFailureA, 2) / expectedFailureA +
    Math.pow(observedSuccessB - expectedSuccessB, 2) / expectedSuccessB +
    Math.pow(observedFailureB - expectedFailureB, 2) / expectedFailureB;
  
  // p-value for chi-square with 1 degree of freedom
  // Using approximation formula
  const pValue = chiSquareToP(chiSquare, 1);
  
  return {
    significant: pValue < 0.05,
    pValue,
    chiSquare,
    message: pValue < 0.05 ? 
      `There is a statistically significant difference between ${variantA} and ${variantB} (p=${pValue.toFixed(4)})` :
      `There is no statistically significant difference between ${variantA} and ${variantB} (p=${pValue.toFixed(4)})`
  };
}

/**
 * Convert chi-square to p-value
 * Approximation for chi-square distribution with k degrees of freedom
 */
function chiSquareToP(chiSquare, degreesOfFreedom) {
  // Simple approximation for chi-square with 1 degree of freedom
  if (degreesOfFreedom === 1) {
    // Formula from: https://en.wikipedia.org/wiki/Chi-squared_distribution#Relation_to_other_distributions
    return 1 - Math.erf(Math.sqrt(chiSquare / 2));
  }
  
  // For other degrees of freedom, return a rough approximation
  return Math.exp(-0.5 * chiSquare);
}

/**
 * Calculate confidence intervals for completion rates
 */
function calculateConfidenceInterval(successes, total, confidence = 0.95) {
  if (total === 0) return { lower: 0, upper: 0, mean: 0 };
  
  const proportion = successes / total;
  const z = 1.96; // 95% confidence interval
  
  const standardError = Math.sqrt((proportion * (1 - proportion)) / total);
  const margin = z * standardError;
  
  return {
    lower: Math.max(0, proportion - margin),
    upper: Math.min(1, proportion + margin),
    mean: proportion
  };
}

/**
 * Analyze A/B test data and determine winner
 */
function analyzeTestResults(variantData, completionRates, metrics) {
  const results = {
    variants: {},
    comparisons: [],
    winner: null,
    confidence: 0,
    metrics: {}
  };
  
  const variants = Object.keys(variantData);
  
  // Calculate metrics for each variant
  variants.forEach(variant => {
    const data = variantData[variant];
    const impressions = data.impressions;
    const engagementRate = impressions > 0 ? data.engagements / impressions : 0;
    const completionRate = impressions > 0 ? data.completions / impressions : 0;
    const averageDuration = data.averageSessionDuration;
    
    results.variants[variant] = {
      impressions,
      engagements: data.engagements,
      engagementRate,
      completions: data.completions,
      completionRate,
      averageDuration,
      averageQueriesPerSession: data.averageQueriesPerSession,
      confidenceInterval: calculateConfidenceInterval(data.completions, impressions)
    };
    
    // Track metrics for scoring
    if (metrics.includes('engagement')) {
      if (!results.metrics.engagement) results.metrics.engagement = [];
      results.metrics.engagement.push({ variant, value: engagementRate });
    }
    
    if (metrics.includes('completion')) {
      if (!results.metrics.completion) results.metrics.completion = [];
      results.metrics.completion.push({ variant, value: completionRate });
    }
    
    if (metrics.includes('duration')) {
      if (!results.metrics.duration) results.metrics.duration = [];
      results.metrics.duration.push({ variant, value: averageDuration });
    }
  });
  
  // Compare all pairs of variants
  for (let i = 0; i < variants.length; i++) {
    for (let j = i + 1; j < variants.length; j++) {
      const variantA = variants[i];
      const variantB = variants[j];
      
      const comparison = calculateChiSquare(variantA, variantB, variantData);
      results.comparisons.push({
        variantA,
        variantB,
        ...comparison
      });
    }
  }
  
  // Score each variant based on the metrics
  const scores = {};
  variants.forEach(variant => {
    scores[variant] = 0;
  });
  
  // Score based on each metric
  Object.keys(results.metrics).forEach(metric => {
    const values = results.metrics[metric];
    
    // Sort by value (higher is better, except for duration where lower is better)
    values.sort((a, b) => {
      if (metric === 'duration') {
        return a.value - b.value; // Lower duration is better
      }
      return b.value - a.value; // Higher is better for other metrics
    });
    
    // Assign points based on rank (3 points for 1st, 2 for 2nd, 1 for 3rd)
    for (let i = 0; i < values.length; i++) {
      const points = values.length - i;
      scores[values[i].variant] += points;
    }
  });
  
  // Find the winner
  let maxScore = -1;
  let winner = null;
  
  Object.entries(scores).forEach(([variant, score]) => {
    if (score > maxScore) {
      maxScore = score;
      winner = variant;
    }
  });
  
  // Calculate confidence based on statistical significance
  let confidence = 0;
  if (winner) {
    const winnerComparisons = results.comparisons.filter(c => 
      c.variantA === winner || c.variantB === winner
    );
    
    const significantWins = winnerComparisons.filter(c => {
      if (c.significant) {
        if (c.variantA === winner) {
          // Winner is A, check if A performs better
          return results.variants[c.variantA].completionRate > results.variants[c.variantB].completionRate;
        } else {
          // Winner is B, check if B performs better
          return results.variants[c.variantB].completionRate > results.variants[c.variantA].completionRate;
        }
      }
      return false;
    }).length;
    
    confidence = significantWins / winnerComparisons.length;
  }
  
  results.winner = winner;
  results.confidence = confidence;
  results.scores = scores;
  
  return results;
}

/**
 * Export results to a file
 */
function exportResults(results, outputDir) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `ab-test-results-${timestamp}.json`;
  const filepath = path.join(outputDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  
  console.log(chalk.green(`Results exported to ${filepath}`));
  return filepath;
}

/**
 * Generate chart HTML for visualization
 */
function generateChartHtml(results, outputDir) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `ab-test-visualization-${timestamp}.html`;
  const filepath = path.join(outputDir, filename);
  
  const variants = Object.keys(results.variants);
  const completionRates = variants.map(v => results.variants[v].completionRate * 100);
  const engagementRates = variants.map(v => results.variants[v].engagementRate * 100);
  const durations = variants.map(v => results.variants[v].averageDuration);
  const queries = variants.map(v => results.variants[v].averageQueriesPerSession);
  
  const confLower = variants.map(v => results.variants[v].confidenceInterval.lower * 100);
  const confUpper = variants.map(v => results.variants[v].confidenceInterval.upper * 100);
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>A/B Test Results - ${timestamp}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .chart-container { width: 100%; height: 400px; margin-bottom: 30px; }
    .results-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .results-table th, .results-table td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    .results-table th { background-color: #f2f2f2; }
    .winner { background-color: #e6ffe6; }
    h1, h2 { color: #333; }
    .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>A/B Test Results</h1>
    
    <div class="summary">
      <h2>Summary</h2>
      <p><strong>Winner:</strong> ${results.winner || 'No clear winner'}</p>
      <p><strong>Confidence:</strong> ${(results.confidence * 100).toFixed(1)}%</p>
      <p><strong>Date:</strong> ${timestamp.split('T')[0]}</p>
    </div>
    
    <h2>Completion Rate</h2>
    <div class="chart-container">
      <canvas id="completionChart"></canvas>
    </div>
    
    <h2>Engagement Rate</h2>
    <div class="chart-container">
      <canvas id="engagementChart"></canvas>
    </div>
    
    <h2>Average Session Duration</h2>
    <div class="chart-container">
      <canvas id="durationChart"></canvas>
    </div>
    
    <h2>Average Queries Per Session</h2>
    <div class="chart-container">
      <canvas id="queriesChart"></canvas>
    </div>
    
    <h2>Variant Performance</h2>
    <table class="results-table">
      <thead>
        <tr>
          <th>Variant</th>
          <th>Impressions</th>
          <th>Engagement Rate</th>
          <th>Completion Rate</th>
          <th>Avg Duration (s)</th>
          <th>Avg Queries</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        ${variants.map(variant => `
          <tr class="${variant === results.winner ? 'winner' : ''}">
            <td>${variant}</td>
            <td>${results.variants[variant].impressions}</td>
            <td>${(results.variants[variant].engagementRate * 100).toFixed(1)}%</td>
            <td>${(results.variants[variant].completionRate * 100).toFixed(1)}%</td>
            <td>${results.variants[variant].averageDuration.toFixed(1)}</td>
            <td>${results.variants[variant].averageQueriesPerSession.toFixed(1)}</td>
            <td>${results.scores[variant]}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <h2>Statistical Comparisons</h2>
    <table class="results-table">
      <thead>
        <tr>
          <th>Comparison</th>
          <th>Significant</th>
          <th>P-value</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${results.comparisons.map(comparison => `
          <tr>
            <td>${comparison.variantA} vs ${comparison.variantB}</td>
            <td>${comparison.significant ? 'Yes' : 'No'}</td>
            <td>${comparison.pValue.toFixed(4)}</td>
            <td>${comparison.message}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  
  <script>
    // Completion rate chart
    new Chart(document.getElementById('completionChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(variants)},
        datasets: [{
          label: 'Completion Rate (%)',
          data: ${JSON.stringify(completionRates)},
          backgroundColor: ${JSON.stringify(variants.map(v => v === results.winner ? 'rgba(75, 192, 192, 0.6)' : 'rgba(54, 162, 235, 0.6)'))},
          borderColor: ${JSON.stringify(variants.map(v => v === results.winner ? 'rgba(75, 192, 192, 1)' : 'rgba(54, 162, 235, 1)'))},
          borderWidth: 1
        }, {
          label: '95% Confidence Interval',
          data: ${JSON.stringify(completionRates)},
          backgroundColor: 'rgba(0, 0, 0, 0)',
          borderColor: 'rgba(0, 0, 0, 0)',
          borderWidth: 0,
          errorBars: {
            show: true,
            color: 'rgba(0, 0, 0, 0.3)',
            lineWidth: 2,
            tipWidth: 6
          },
          errorBarWhiskerColor: 'rgba(0, 0, 0, 0.3)',
          errorBarWhiskerWidth: 1,
          errorBarWhiskerSize: 6,
          errorBarLineWidth: 2,
          errorBarColor: 'rgba(0, 0, 0, 0.3)',
          errorBarData: {
            min: ${JSON.stringify(confLower)},
            max: ${JSON.stringify(confUpper)}
          }
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Completion Rate (%)'
            }
          }
        }
      }
    });
    
    // Engagement rate chart
    new Chart(document.getElementById('engagementChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(variants)},
        datasets: [{
          label: 'Engagement Rate (%)',
          data: ${JSON.stringify(engagementRates)},
          backgroundColor: 'rgba(255, 159, 64, 0.6)',
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Engagement Rate (%)'
            }
          }
        }
      }
    });
    
    // Duration chart
    new Chart(document.getElementById('durationChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(variants)},
        datasets: [{
          label: 'Average Duration (seconds)',
          data: ${JSON.stringify(durations)},
          backgroundColor: 'rgba(153, 102, 255, 0.6)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Seconds'
            }
          }
        }
      }
    });
    
    // Queries chart
    new Chart(document.getElementById('queriesChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(variants)},
        datasets: [{
          label: 'Average Queries Per Session',
          data: ${JSON.stringify(queries)},
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Queries'
            }
          }
        }
      }
    });
  </script>
</body>
</html>
  `;
  
  fs.writeFileSync(filepath, html);
  
  console.log(chalk.green(`Visualization exported to ${filepath}`));
  return filepath;
}

/**
 * Print results summary to console
 */
function printResultsSummary(results) {
  console.log('\n' + chalk.blue('=== A/B Test Results ==='));
  
  if (results.winner) {
    console.log(chalk.green(`\nWinner: ${results.winner} (${(results.confidence * 100).toFixed(1)}% confidence)`));
  } else {
    console.log(chalk.yellow('\nNo clear winner determined.'));
  }
  
  console.log('\nVariant Performance:');
  const variants = Object.keys(results.variants);
  const winnerSymbol = '🏆';
  
  // Table header
  console.log('╔════════════╦════════════╦════════════╦════════════╦════════════╦════════════╗');
  console.log('║ Variant    ║ Impressions ║ Engagement ║ Completion ║   Duration ║     Score  ║');
  console.log('╠════════════╬════════════╬════════════╬════════════╬════════════╬════════════╣');
  
  // Table rows
  variants.forEach(variant => {
    const data = results.variants[variant];
    const isWinner = variant === results.winner;
    
    console.log(
      `║ ${variant.padEnd(10)} ║ ` +
      `${data.impressions.toString().padEnd(10)} ║ ` +
      `${(data.engagementRate * 100).toFixed(1).padStart(7)}% ║ ` +
      `${(data.completionRate * 100).toFixed(1).padStart(7)}% ║ ` +
      `${data.averageDuration.toFixed(1).padStart(9)}s ║ ` +
      `${results.scores[variant].toString().padStart(8)}${isWinner ? winnerSymbol : ' '} ║`
    );
  });
  
  // Table footer
  console.log('╚════════════╩════════════╩════════════╩════════════╩════════════╩════════════╝');
  
  // Statistical significance
  console.log('\nStatistical Significance:');
  results.comparisons.forEach(comparison => {
    const significance = comparison.significant ? 
      chalk.green('Significant') : 
      chalk.yellow('Not significant');
    
    console.log(`- ${comparison.variantA} vs ${comparison.variantB}: ${significance} (p=${comparison.pValue.toFixed(4)})`);
  });
  
  // Recommendations
  console.log('\n' + chalk.blue('=== Recommendations ==='));
  if (results.winner) {
    const winnerData = results.variants[results.winner];
    console.log(`1. Implement the ${chalk.green(results.winner)} variant as the default.`);
    console.log(`2. Expected completion rate: ${chalk.green((winnerData.completionRate * 100).toFixed(1))}%`);
    
    if (results.confidence < 0.8) {
      console.log(chalk.yellow(`3. Continue testing to increase confidence (current: ${(results.confidence * 100).toFixed(1)}%)`));
    }
  } else {
    console.log(chalk.yellow('1. Continue testing with larger sample sizes to determine a clear winner.'));
    console.log('2. Consider adjusting variants to create more distinct user experiences.');
  }
}

/**
 * Main function
 */
async function main() {
  const { since, until, output, variants: variantsStr, metrics: metricsStr } = options;
  
  // Parse variants and metrics
  const variants = variantsStr.split(',').map(v => v.trim());
  const metrics = metricsStr.split(',').map(m => m.trim());
  
  console.log(chalk.blue(`=== PersLM A/B Test Analysis ===`));
  console.log(`Date Range: ${since} to ${until}`);
  console.log(`Variants: ${variants.join(', ')}`);
  console.log(`Metrics: ${metrics.join(', ')}`);
  
  // Initialize output directory
  initOutputDir(output);
  
  // Get log files in date range
  const files = getLogFiles(since, until);
  
  if (files.length === 0) {
    console.log(chalk.yellow(`No log files found in the specified date range.`));
    return;
  }
  
  console.log(chalk.blue(`Found ${files.length} log files to process.`));
  
  // Process log files
  const { variantData, completionRates } = await processLogFiles(files, variants);
  
  // Check if we have enough data
  const hasEnoughData = variants.every(variant => variantData[variant].impressions >= 30);
  
  if (!hasEnoughData) {
    console.log(chalk.yellow(`\nWarning: Some variants have insufficient data for reliable analysis.`));
    variants.forEach(variant => {
      if (variantData[variant].impressions < 30) {
        console.log(chalk.yellow(`- ${variant}: only ${variantData[variant].impressions} impressions (need 30+)`));
      }
    });
  }
  
  // Analyze results
  const results = analyzeTestResults(variantData, completionRates, metrics);
  
  // Print summary
  printResultsSummary(results);
  
  // Export results
  exportResults(results, output);
  
  // Generate visualization
  generateChartHtml(results, output);
  
  console.log(chalk.green('\nA/B test analysis completed successfully.'));
}

// Run the script
main().catch(error => {
  console.error(chalk.red(`Analysis failed with error: ${error.message}`));
  console.error(error.stack);
  process.exit(1);
}); 