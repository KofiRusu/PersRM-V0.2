#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { spawn } = require('child_process');
const { program } = require('commander');
const chalk = require('chalk');
const fetch = require('node-fetch');
const Table = require('cli-table3');

const BENCHMARK_DIR = path.join(process.cwd(), 'benchmarks');
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'benchmark-results');
const DEFAULT_TEST_QUERIES = path.join(BENCHMARK_DIR, 'test-queries.json');
const API_ENDPOINTS = {
  reasoning: '/api/reasoning',
  codegen: '/api/codegen',
  route: '/api/route'
};

// Define CLI options
program
  .description('Run system benchmark tests for the reasoning assistant')
  .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT_DIR)
  .option('-q, --queries <path>', 'Path to test queries JSON file', DEFAULT_TEST_QUERIES)
  .option('-b, --base-url <url>', 'Base URL for API endpoints', 'http://localhost:3000')
  .option('-c, --concurrency <number>', 'Number of concurrent requests', '1')
  .option('-i, --iterations <number>', 'Number of iterations for each test', '3')
  .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '60000')
  .option('-e, --endpoints <endpoints>', 'Comma-separated list of endpoints to test', 'reasoning,codegen,route')
  .option('-s, --server', 'Start a local server for testing')
  .option('-p, --port <number>', 'Port for local server', '3001')
  .option('-m, --memory', 'Include memory usage statistics (Node.js only)')
  .option('-d, --delay <ms>', 'Delay between requests in milliseconds', '1000')
  .parse(process.argv);

const options = program.opts();
let serverProcess;

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
 * Load test queries from file
 */
function loadTestQueries(queryFile) {
  if (!fs.existsSync(queryFile)) {
    console.error(chalk.red(`Test queries file not found: ${queryFile}`));
    console.log(chalk.yellow(`Creating a sample test queries file...`));
    createSampleQueriesFile(queryFile);
  }
  
  try {
    return JSON.parse(fs.readFileSync(queryFile, 'utf8'));
  } catch (error) {
    console.error(chalk.red(`Error parsing test queries file: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Create a sample test queries file
 */
function createSampleQueriesFile(filePath) {
  const sampleQueries = {
    reasoning: [
      {
        name: "Modal vs Dialog",
        input: "Should I use a modal dialog or a slide-over panel for form input?",
        expectedTokens: 1200
      },
      {
        name: "Form Validation",
        input: "What's the best approach for form validation in React?",
        expectedTokens: 1500
      },
      {
        name: "Layout Structure",
        input: "How should I structure my dashboard layout for responsive design?",
        expectedTokens: 1800
      }
    ],
    codegen: [
      {
        name: "Button Component",
        input: "Create a reusable button component with variants",
        expectedTokens: 800
      },
      {
        name: "Data Table",
        input: "Generate a sortable and filterable data table component",
        expectedTokens: 1200
      }
    ],
    route: [
      {
        name: "Authentication API",
        input: "Create authentication routes with JWT",
        expectedTokens: 1000
      },
      {
        name: "CRUD API",
        input: "Generate CRUD API routes for a blog post resource",
        expectedTokens: 1500
      }
    ]
  };
  
  fs.writeFileSync(filePath, JSON.stringify(sampleQueries, null, 2));
  console.log(chalk.green(`Created sample test queries file at ${filePath}`));
}

/**
 * Start a local server for testing
 */
function startLocalServer(port) {
  return new Promise((resolve, reject) => {
    console.log(chalk.blue(`Starting local server on port ${port}...`));
    
    serverProcess = spawn('npm', ['run', 'dev', '--', '-p', port], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    let started = false;
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('ready') && !started) {
        console.log(chalk.green(`Server started on port ${port}`));
        started = true;
        // Give it a moment to fully initialize
        setTimeout(() => resolve(serverProcess), 2000);
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error(chalk.yellow(`Server stderr: ${data.toString()}`));
    });
    
    serverProcess.on('error', (error) => {
      console.error(chalk.red(`Failed to start server: ${error.message}`));
      reject(error);
    });
    
    // Set a timeout in case the server doesn't start
    setTimeout(() => {
      if (!started) {
        console.error(chalk.red(`Server failed to start within timeout period`));
        killServer();
        reject(new Error('Server start timeout'));
      }
    }, 30000);
  });
}

/**
 * Kill the server process
 */
function killServer() {
  if (serverProcess) {
    console.log(chalk.blue('Shutting down local server...'));
    serverProcess.kill('SIGINT');
    serverProcess = null;
  }
}

/**
 * Wait for specified milliseconds
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make a request to the API endpoint
 */
async function makeRequest(baseUrl, endpoint, query, timeout) {
  const startTime = performance.now();
  let responseTime = 0;
  let error = null;
  let response = null;
  let tokenCount = 0;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        query: query.input,
        test: true // Flag to indicate this is a test request
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    responseTime = performance.now() - startTime;
    
    if (!res.ok) {
      error = `API returned status ${res.status}`;
    } else {
      response = await res.json();
      // Estimate token count based on response length
      // This is a rough approximation - proper token counting depends on the model's tokenizer
      if (response.reasoning) {
        tokenCount = Math.round(response.reasoning.length / 4); // ~4 chars per token on average
      } else if (response.code) {
        tokenCount = Math.round(response.code.length / 4);
      } else if (response.route) {
        tokenCount = Math.round(JSON.stringify(response).length / 4);
      }
    }
  } catch (err) {
    error = err.name === 'AbortError' ? 'Request timeout' : err.message;
    responseTime = performance.now() - startTime;
  }
  
  return {
    responseTime,
    error,
    response,
    tokenCount
  };
}

/**
 * Run benchmarks for a specific endpoint
 */
async function runEndpointBenchmark(baseUrl, endpoint, queries, iterations, concurrency, timeout, delay) {
  console.log(chalk.blue(`\nRunning benchmark for ${endpoint} endpoint...`));
  
  // Get the appropriate queries for this endpoint
  const endpointType = endpoint.replace('/api/', '');
  const testQueries = queries[endpointType] || [];
  
  if (testQueries.length === 0) {
    console.log(chalk.yellow(`No test queries defined for ${endpointType}. Skipping.`));
    return null;
  }
  
  const results = [];
  
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(chalk.cyan(`\nTesting query: ${query.name}`));
    
    const queryResults = [];
    
    for (let iter = 0; iter < iterations; iter++) {
      console.log(chalk.dim(`  Iteration ${iter + 1}/${iterations}`));
      
      // Run requests with specified concurrency
      const batchResults = [];
      for (let batch = 0; batch < Math.ceil(concurrency); batch++) {
        if (batch > 0) {
          await wait(delay); // Wait between batch requests
        }
        
        const memoryBefore = process.memoryUsage();
        const result = await makeRequest(baseUrl, endpoint, query, timeout);
        const memoryAfter = process.memoryUsage();
        
        const success = !result.error;
        
        // Calculate memory usage delta (in MB)
        const memoryDelta = {
          rss: (memoryAfter.rss - memoryBefore.rss) / (1024 * 1024),
          heapTotal: (memoryAfter.heapTotal - memoryBefore.heapTotal) / (1024 * 1024),
          heapUsed: (memoryAfter.heapUsed - memoryBefore.heapUsed) / (1024 * 1024)
        };
        
        batchResults.push({
          ...result,
          success,
          memoryDelta,
          timestamp: new Date().toISOString()
        });
        
        // Log result
        if (success) {
          console.log(chalk.green(`    ✓ Response time: ${result.responseTime.toFixed(0)}ms, Tokens: ${result.tokenCount}`));
        } else {
          console.log(chalk.red(`    ✗ Error: ${result.error} (${result.responseTime.toFixed(0)}ms)`));
        }
      }
      
      queryResults.push(...batchResults);
      
      if (iter < iterations - 1) {
        await wait(delay); // Wait between iterations
      }
    }
    
    // Calculate statistics for this query
    const responseTimesSuccessful = queryResults
      .filter(r => r.success)
      .map(r => r.responseTime);
    
    let min = 0, max = 0, avg = 0, median = 0, p95 = 0, successRate = 0;
    
    if (responseTimesSuccessful.length > 0) {
      // Sort times for percentile calculations
      responseTimesSuccessful.sort((a, b) => a - b);
      
      min = responseTimesSuccessful[0];
      max = responseTimesSuccessful[responseTimesSuccessful.length - 1];
      avg = responseTimesSuccessful.reduce((sum, time) => sum + time, 0) / responseTimesSuccessful.length;
      
      // Calculate median (50th percentile)
      const midIndex = Math.floor(responseTimesSuccessful.length / 2);
      median = responseTimesSuccessful.length % 2 === 0
        ? (responseTimesSuccessful[midIndex - 1] + responseTimesSuccessful[midIndex]) / 2
        : responseTimesSuccessful[midIndex];
      
      // Calculate 95th percentile
      const p95Index = Math.ceil(responseTimesSuccessful.length * 0.95) - 1;
      p95 = responseTimesSuccessful[p95Index];
    }
    
    // Calculate success rate
    successRate = queryResults.filter(r => r.success).length / queryResults.length;
    
    // Calculate average tokens
    const avgTokens = queryResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.tokenCount, 0) / Math.max(1, responseTimesSuccessful.length);
    
    const tokenAccuracy = query.expectedTokens
      ? Math.min(avgTokens / query.expectedTokens, query.expectedTokens / avgTokens)
      : null;
    
    // Calculate average memory usage delta
    const avgMemoryDelta = {
      rss: queryResults.reduce((sum, r) => sum + r.memoryDelta.rss, 0) / queryResults.length,
      heapTotal: queryResults.reduce((sum, r) => sum + r.memoryDelta.heapTotal, 0) / queryResults.length,
      heapUsed: queryResults.reduce((sum, r) => sum + r.memoryDelta.heapUsed, 0) / queryResults.length
    };
    
    results.push({
      endpoint,
      query: query.name,
      input: query.input,
      min,
      max,
      avg,
      median,
      p95,
      successRate,
      iterations: queryResults.length,
      avgTokens,
      expectedTokens: query.expectedTokens,
      tokenAccuracy,
      avgMemoryDelta,
      rawResults: queryResults
    });
    
    // Print summary for this query
    console.log(chalk.cyan(`  Summary for "${query.name}":`));
    console.log(`    Success Rate: ${(successRate * 100).toFixed(1)}%`);
    console.log(`    Response Time: avg ${avg.toFixed(0)}ms, median ${median.toFixed(0)}ms, p95 ${p95.toFixed(0)}ms`);
    console.log(`    Tokens: avg ${avgTokens.toFixed(0)}, expected ${query.expectedTokens || 'N/A'}`);
    if (tokenAccuracy) {
      console.log(`    Token Accuracy: ${(tokenAccuracy * 100).toFixed(1)}%`);
    }
  }
  
  return results;
}

/**
 * Export benchmark results
 */
function exportResults(results, outputDir) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `benchmark-results-${timestamp}.json`;
  const filepath = path.join(outputDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  
  console.log(chalk.green(`\nResults exported to ${filepath}`));
  return filepath;
}

/**
 * Generate HTML report from benchmark results
 */
function generateHtmlReport(results, outputDir) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `benchmark-report-${timestamp}.html`;
  const filepath = path.join(outputDir, filename);
  
  // Prepare data for charts
  const endpoints = [...new Set(results.map(r => r.endpoint))];
  const queries = [...new Set(results.map(r => r.query))];
  
  const responseTimeByEndpoint = {};
  const successRateByEndpoint = {};
  
  endpoints.forEach(endpoint => {
    const endpointResults = results.filter(r => r.endpoint === endpoint);
    responseTimeByEndpoint[endpoint] = endpointResults.map(r => r.avg);
    successRateByEndpoint[endpoint] = endpointResults.map(r => r.successRate * 100);
  });
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Benchmark Results - ${timestamp}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .chart-container { width: 100%; height: 400px; margin-bottom: 30px; }
    .results-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .results-table th, .results-table td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    .results-table th { background-color: #f2f2f2; }
    h1, h2 { color: #333; }
    .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .metric-card {
      background-color: #fff;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      padding: 15px;
      margin-bottom: 15px;
    }
    .metric-title { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
    .metric-value { font-size: 24px; font-weight: bold; }
    .metric-subtitle { font-size: 12px; color: #666; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Benchmark Results</h1>
    
    <div class="summary">
      <h2>Summary</h2>
      <p><strong>Date:</strong> ${timestamp.split('T')[0]}</p>
      <p><strong>Endpoints Tested:</strong> ${endpoints.map(e => e.replace('/api/', '')).join(', ')}</p>
      <p><strong>Queries Tested:</strong> ${queries.length}</p>
    </div>
    
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-title">Average Response Time</div>
        <div class="metric-value">${results.reduce((sum, r) => sum + r.avg, 0) / results.length >= 1000 
          ? (results.reduce((sum, r) => sum + r.avg, 0) / results.length / 1000).toFixed(2) + 's'
          : (results.reduce((sum, r) => sum + r.avg, 0) / results.length).toFixed(0) + 'ms'}</div>
        <div class="metric-subtitle">Across all endpoints</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-title">Success Rate</div>
        <div class="metric-value">${(results.reduce((sum, r) => sum + r.successRate, 0) / results.length * 100).toFixed(1)}%</div>
        <div class="metric-subtitle">Successful requests</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-title">Median Response Time</div>
        <div class="metric-value">${results.reduce((sum, r) => sum + r.median, 0) / results.length >= 1000
          ? (results.reduce((sum, r) => sum + r.median, 0) / results.length / 1000).toFixed(2) + 's'
          : (results.reduce((sum, r) => sum + r.median, 0) / results.length).toFixed(0) + 'ms'}</div>
        <div class="metric-subtitle">50th percentile</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-title">p95 Response Time</div>
        <div class="metric-value">${results.reduce((sum, r) => sum + r.p95, 0) / results.length >= 1000
          ? (results.reduce((sum, r) => sum + r.p95, 0) / results.length / 1000).toFixed(2) + 's'
          : (results.reduce((sum, r) => sum + r.p95, 0) / results.length).toFixed(0) + 'ms'}</div>
        <div class="metric-subtitle">95th percentile</div>
      </div>
    </div>
    
    <h2>Response Time by Endpoint</h2>
    <div class="chart-container">
      <canvas id="responseTimeChart"></canvas>
    </div>
    
    <h2>Success Rate by Endpoint</h2>
    <div class="chart-container">
      <canvas id="successRateChart"></canvas>
    </div>
    
    <h2>Detailed Results</h2>
    <table class="results-table">
      <thead>
        <tr>
          <th>Endpoint</th>
          <th>Query</th>
          <th>Success Rate</th>
          <th>Avg Time</th>
          <th>Median</th>
          <th>p95</th>
          <th>Tokens</th>
        </tr>
      </thead>
      <tbody>
        ${results.map(result => `
          <tr>
            <td>${result.endpoint.replace('/api/', '')}</td>
            <td>${result.query}</td>
            <td>${(result.successRate * 100).toFixed(1)}%</td>
            <td>${result.avg.toFixed(0)}ms</td>
            <td>${result.median.toFixed(0)}ms</td>
            <td>${result.p95.toFixed(0)}ms</td>
            <td>${result.avgTokens.toFixed(0)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  
  <script>
    // Response time chart
    new Chart(document.getElementById('responseTimeChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(queries)},
        datasets: ${JSON.stringify(
          endpoints.map((endpoint, index) => ({
            label: endpoint.replace('/api/', ''),
            data: responseTimeByEndpoint[endpoint],
            backgroundColor: [
              'rgba(75, 192, 192, 0.6)',
              'rgba(54, 162, 235, 0.6)',
              'rgba(153, 102, 255, 0.6)'
            ][index % 3],
            borderColor: [
              'rgba(75, 192, 192, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(153, 102, 255, 1)'
            ][index % 3],
            borderWidth: 1
          }))
        )}
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Response Time (ms)'
            }
          }
        }
      }
    });
    
    // Success rate chart
    new Chart(document.getElementById('successRateChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(queries)},
        datasets: ${JSON.stringify(
          endpoints.map((endpoint, index) => ({
            label: endpoint.replace('/api/', ''),
            data: successRateByEndpoint[endpoint],
            backgroundColor: [
              'rgba(75, 192, 192, 0.6)',
              'rgba(54, 162, 235, 0.6)',
              'rgba(153, 102, 255, 0.6)'
            ][index % 3],
            borderColor: [
              'rgba(75, 192, 192, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(153, 102, 255, 1)'
            ][index % 3],
            borderWidth: 1
          }))
        )}
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Success Rate (%)'
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
  
  console.log(chalk.green(`\nHTML report generated at ${filepath}`));
  return filepath;
}

/**
 * Print benchmark summary
 */
function printBenchmarkSummary(results) {
  console.log('\n' + chalk.blue('=== Benchmark Summary ==='));
  
  // Group results by endpoint
  const endpointResults = {};
  results.forEach(result => {
    const endpoint = result.endpoint.replace('/api/', '');
    if (!endpointResults[endpoint]) {
      endpointResults[endpoint] = [];
    }
    endpointResults[endpoint].push(result);
  });
  
  // Create endpoint summary table
  const endpointTable = new Table({
    head: ['Endpoint', 'Avg Time', 'Median', 'p95', 'Success Rate'],
    style: { head: ['cyan'] }
  });
  
  Object.entries(endpointResults).forEach(([endpoint, results]) => {
    const avgTime = results.reduce((sum, r) => sum + r.avg, 0) / results.length;
    const medianTime = results.reduce((sum, r) => sum + r.median, 0) / results.length;
    const p95Time = results.reduce((sum, r) => sum + r.p95, 0) / results.length;
    const successRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
    
    endpointTable.push([
      endpoint,
      `${avgTime.toFixed(0)}ms`,
      `${medianTime.toFixed(0)}ms`,
      `${p95Time.toFixed(0)}ms`,
      `${(successRate * 100).toFixed(1)}%`
    ]);
  });
  
  console.log(endpointTable.toString());
  
  // Create query details table
  console.log('\n' + chalk.blue('=== Query Details ==='));
  
  const queryTable = new Table({
    head: ['Endpoint', 'Query', 'Avg Time', 'Success', 'Tokens'],
    style: { head: ['cyan'] }
  });
  
  results.forEach(result => {
    queryTable.push([
      result.endpoint.replace('/api/', ''),
      result.query,
      `${result.avg.toFixed(0)}ms`,
      `${(result.successRate * 100).toFixed(1)}%`,
      `${result.avgTokens.toFixed(0)}`
    ]);
  });
  
  console.log(queryTable.toString());
  
  // Overall statistics
  const avgTime = results.reduce((sum, r) => sum + r.avg, 0) / results.length;
  const avgSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
  
  console.log('\n' + chalk.blue('=== Overall Performance ==='));
  console.log(`Average Response Time: ${avgTime.toFixed(0)}ms`);
  console.log(`Success Rate: ${(avgSuccessRate * 100).toFixed(1)}%`);
  
  // Recommendations based on results
  console.log('\n' + chalk.blue('=== Recommendations ==='));
  
  // Check for slow endpoints
  const slowThreshold = 2000; // 2 seconds
  const slowEndpoints = results
    .filter(r => r.avg > slowThreshold)
    .map(r => `${r.endpoint.replace('/api/', '')} (${r.query}): ${r.avg.toFixed(0)}ms`);
  
  if (slowEndpoints.length > 0) {
    console.log(chalk.yellow(`Slow endpoints detected (>${slowThreshold}ms):`));
    slowEndpoints.forEach(endpoint => console.log(`- ${endpoint}`));
  } else {
    console.log(chalk.green(`✓ All endpoints responding within ${slowThreshold}ms threshold`));
  }
  
  // Check for low success rates
  const lowSuccessThreshold = 0.9; // 90%
  const lowSuccessEndpoints = results
    .filter(r => r.successRate < lowSuccessThreshold)
    .map(r => `${r.endpoint.replace('/api/', '')} (${r.query}): ${(r.successRate * 100).toFixed(1)}%`);
  
  if (lowSuccessEndpoints.length > 0) {
    console.log(chalk.yellow(`Low success rates detected (<${lowSuccessThreshold * 100}%):`));
    lowSuccessEndpoints.forEach(endpoint => console.log(`- ${endpoint}`));
  } else {
    console.log(chalk.green(`✓ All endpoints have success rates above ${lowSuccessThreshold * 100}%`));
  }
  
  // Check token accuracy
  const tokenAccuracyThreshold = 0.8; // 80%
  const lowTokenAccuracy = results
    .filter(r => r.tokenAccuracy !== null && r.tokenAccuracy < tokenAccuracyThreshold)
    .map(r => `${r.endpoint.replace('/api/', '')} (${r.query}): ${(r.tokenAccuracy * 100).toFixed(1)}%`);
  
  if (lowTokenAccuracy.length > 0) {
    console.log(chalk.yellow(`Low token accuracy detected (<${tokenAccuracyThreshold * 100}%):`));
    lowTokenAccuracy.forEach(endpoint => console.log(`- ${endpoint}`));
  } else if (results.some(r => r.tokenAccuracy !== null)) {
    console.log(chalk.green(`✓ All endpoints have token accuracy above ${tokenAccuracyThreshold * 100}%`));
  }
}

/**
 * Main function
 */
async function main() {
  const {
    output,
    queries: queriesPath,
    baseUrl,
    concurrency,
    iterations,
    timeout,
    endpoints: endpointsStr,
    server,
    port,
    memory,
    delay
  } = options;
  
  // Parse endpoints
  const endpoints = endpointsStr.split(',')
    .map(e => e.trim())
    .filter(e => API_ENDPOINTS[e])
    .map(e => API_ENDPOINTS[e]);
  
  if (endpoints.length === 0) {
    console.error(chalk.red(`No valid endpoints specified. Available endpoints: ${Object.keys(API_ENDPOINTS).join(', ')}`));
    process.exit(1);
  }
  
  console.log(chalk.blue(`=== PersLM System Benchmark ===`));
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Endpoints: ${endpoints.join(', ')}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Iterations: ${iterations}`);
  console.log(`Timeout: ${timeout}ms`);
  
  // Initialize output directory
  initOutputDir(output);
  
  // Load test queries
  const queries = loadTestQueries(queriesPath);
  
  // Start local server if requested
  if (server) {
    try {
      await startLocalServer(port);
      options.baseUrl = `http://localhost:${port}`;
      console.log(chalk.blue(`Using local server at ${options.baseUrl}`));
    } catch (error) {
      console.error(chalk.red(`Failed to start local server: ${error.message}`));
      process.exit(1);
    }
  }
  
  let allResults = [];
  
  try {
    // Run benchmarks for each endpoint
    for (const endpoint of endpoints) {
      const results = await runEndpointBenchmark(
        baseUrl,
        endpoint,
        queries,
        parseInt(iterations),
        parseInt(concurrency),
        parseInt(timeout),
        parseInt(delay)
      );
      
      if (results) {
        allResults = allResults.concat(results);
      }
    }
    
    // Export results
    if (allResults.length > 0) {
      exportResults(allResults, output);
      generateHtmlReport(allResults, output);
      printBenchmarkSummary(allResults);
    } else {
      console.log(chalk.yellow(`\nNo benchmark results to export.`));
    }
  } finally {
    // Clean up
    if (server) {
      killServer();
    }
  }
}

// Handle clean shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\nBenchmark interrupted.'));
  killServer();
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error(chalk.red(`Benchmark failed with error: ${error.message}`));
  console.error(error.stack);
  killServer();
  process.exit(1);
}); 