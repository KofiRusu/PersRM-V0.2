#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const fetch = require('node-fetch');
const os = require('os');
const v8 = require('v8');
const chalk = require('chalk');

const BENCHMARK_DIR = path.join(process.cwd(), 'benchmark-reports');
const API_URL = 'http://localhost:3000/api/reasoning';
const ITERATIONS = 10;
const CONCURRENCY_LEVELS = [1, 5, 10];
const SAMPLE_QUESTIONS = [
  "How should I design a navigation for a mobile app with 5 main sections?",
  "What's the best way to implement a light/dark mode toggle in a Next.js app?",
  "Should I use a modal or a separate page for user registration?",
  "How should I design form validation for a multi-step checkout process?",
  "What's the optimal layout for a dashboard with multiple widgets and filters?"
];

/**
 * Initialize benchmark directory
 */
function initBenchmarkDir() {
  if (!fs.existsSync(BENCHMARK_DIR)) {
    fs.mkdirSync(BENCHMARK_DIR, { recursive: true });
    console.log(chalk.blue(`Created benchmark directory at ${BENCHMARK_DIR}`));
  }
}

/**
 * Get system info for the benchmark
 */
function getSystemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100 + ' GB',
    nodeVersion: process.version,
    v8Version: v8.getHeapStatistics(),
    date: new Date().toISOString(),
  };
}

/**
 * Send a request to the API
 */
async function sendRequest(question) {
  try {
    const start = performance.now();
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });
    
    const end = performance.now();
    const responseTime = end - start;
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      success: true,
      responseTime,
      dataSize: JSON.stringify(data).length,
      status: response.status,
    };
  } catch (error) {
    console.error(chalk.red(`Request failed: ${error.message}`));
    return {
      success: false,
      error: error.message,
      responseTime: 0,
    };
  }
}

/**
 * Run sequential benchmark
 */
async function runSequentialBenchmark() {
  console.log(chalk.blue(`Running sequential benchmark (${ITERATIONS} iterations)...`));
  
  const results = [];
  
  for (let i = 0; i < ITERATIONS; i++) {
    const question = SAMPLE_QUESTIONS[i % SAMPLE_QUESTIONS.length];
    console.log(chalk.gray(`  Iteration ${i + 1}/${ITERATIONS}: "${question.substring(0, 30)}..."`));
    
    const result = await sendRequest(question);
    results.push(result);
    
    // Output progress
    if (result.success) {
      console.log(chalk.green(`    ✓ Response time: ${result.responseTime.toFixed(2)}ms`));
    } else {
      console.log(chalk.red(`    ✗ Failed: ${result.error}`));
    }
  }
  
  return results;
}

/**
 * Run concurrent benchmarks
 */
async function runConcurrentBenchmark(concurrencyLevel) {
  console.log(chalk.blue(`Running concurrent benchmark (${concurrencyLevel} concurrent requests)...`));
  
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  const start = performance.now();
  
  const promises = [];
  for (let i = 0; i < concurrencyLevel; i++) {
    const question = SAMPLE_QUESTIONS[i % SAMPLE_QUESTIONS.length];
    promises.push(sendRequest(question));
  }
  
  const results = await Promise.all(promises);
  
  const end = performance.now();
  const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  
  console.log(chalk.green(`  Completed ${concurrencyLevel} concurrent requests in ${(end - start).toFixed(2)}ms`));
  console.log(chalk.green(`  Memory usage: ${(endMemory - startMemory).toFixed(2)}MB`));
  
  return {
    totalTime: end - start,
    results,
    memoryUsage: endMemory - startMemory,
  };
}

/**
 * Calculate statistics from benchmark results
 */
function calculateStats(results) {
  const successfulResults = results.filter(r => r.success);
  
  if (successfulResults.length === 0) {
    return {
      success: false,
      errorRate: 1,
      message: 'All requests failed',
    };
  }
  
  const responseTimes = successfulResults.map(r => r.responseTime);
  
  return {
    success: true,
    totalRequests: results.length,
    successfulRequests: successfulResults.length,
    errorRate: (results.length - successfulResults.length) / results.length,
    responseTimes: {
      min: Math.min(...responseTimes),
      max: Math.max(...responseTimes),
      avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p95: calculatePercentile(responseTimes, 95),
      p99: calculatePercentile(responseTimes, 99),
    },
    dataSizes: successfulResults.map(r => r.dataSize),
  };
}

/**
 * Calculate a percentile value
 */
function calculatePercentile(array, percentile) {
  const sorted = [...array].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

/**
 * Compare with previous benchmark results
 */
function compareWithPrevious(currentResults) {
  try {
    const files = fs.readdirSync(BENCHMARK_DIR)
      .filter(file => file.startsWith('benchmark-') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length <= 1) {
      console.log(chalk.yellow('No previous benchmark results found for comparison.'));
      return { current: currentResults };
    }
    
    const previousFile = files[1];
    const previousResults = JSON.parse(fs.readFileSync(path.join(BENCHMARK_DIR, previousFile), 'utf8'));
    
    console.log(chalk.blue(`Comparing with previous benchmark: ${previousFile}`));
    
    const comparison = {
      current: currentResults,
      previous: previousResults,
      changes: {
        responseTime: {
          current: currentResults.sequential.stats.responseTimes.avg.toFixed(2),
          previous: previousResults.sequential.stats.responseTimes.avg.toFixed(2),
          change: calculatePercentageChange(
            previousResults.sequential.stats.responseTimes.avg,
            currentResults.sequential.stats.responseTimes.avg
          ),
        },
        throughput: {
          current: (1000 / currentResults.sequential.stats.responseTimes.avg).toFixed(2),
          previous: (1000 / previousResults.sequential.stats.responseTimes.avg).toFixed(2),
          change: calculatePercentageChange(
            1000 / previousResults.sequential.stats.responseTimes.avg,
            1000 / currentResults.sequential.stats.responseTimes.avg
          ),
        },
        errorRate: {
          current: (currentResults.sequential.stats.errorRate * 100).toFixed(2) + '%',
          previous: (previousResults.sequential.stats.errorRate * 100).toFixed(2) + '%',
          change: calculatePercentageChange(
            previousResults.sequential.stats.errorRate * 100,
            currentResults.sequential.stats.errorRate * 100
          ),
        },
        memoryUsage: {
          current: currentResults.concurrent[1].memoryUsage.toFixed(2),
          previous: previousResults.concurrent[1].memoryUsage.toFixed(2),
          change: calculatePercentageChange(
            previousResults.concurrent[1].memoryUsage,
            currentResults.concurrent[1].memoryUsage
          ),
        },
      },
    };
    
    return comparison;
  } catch (error) {
    console.error(chalk.red(`Error comparing with previous results: ${error.message}`));
    return { current: currentResults };
  }
}

/**
 * Calculate percentage change between two values
 */
function calculatePercentageChange(previous, current) {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Save benchmark results to a file
 */
function saveBenchmarkResults(results, comparison) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filePath = path.join(BENCHMARK_DIR, `benchmark-${timestamp}.json`);
  
  // Extract summary data for reporting
  const summaryData = {
    responseTime: comparison.changes?.responseTime || { 
      current: results.sequential.stats.responseTimes.avg.toFixed(2), 
      change: 0 
    },
    throughput: comparison.changes?.throughput || { 
      current: (1000 / results.sequential.stats.responseTimes.avg).toFixed(2), 
      change: 0 
    },
    errorRate: comparison.changes?.errorRate || { 
      current: (results.sequential.stats.errorRate * 100).toFixed(2) + '%', 
      change: 0 
    },
    memoryUsage: comparison.changes?.memoryUsage || { 
      current: results.concurrent[1].memoryUsage.toFixed(2), 
      change: 0 
    },
  };
  
  // Add summary data to results
  const resultsWithSummary = {
    ...results,
    summary: summaryData,
    comparison: comparison.changes,
    timestamp,
  };
  
  fs.writeFileSync(filePath, JSON.stringify(resultsWithSummary, null, 2));
  console.log(chalk.green(`Benchmark results saved to ${filePath}`));
  
  return { filePath, summaryData };
}

/**
 * Print benchmark summary
 */
function printBenchmarkSummary(results, comparison) {
  console.log('\n' + chalk.blue('=== Benchmark Summary ==='));
  
  console.log(chalk.blue('\nSequential Requests:'));
  console.log(`  Average Response Time: ${results.sequential.stats.responseTimes.avg.toFixed(2)}ms`);
  console.log(`  Min/Max Response Time: ${results.sequential.stats.responseTimes.min.toFixed(2)}ms / ${results.sequential.stats.responseTimes.max.toFixed(2)}ms`);
  console.log(`  P95/P99 Response Time: ${results.sequential.stats.responseTimes.p95.toFixed(2)}ms / ${results.sequential.stats.responseTimes.p99.toFixed(2)}ms`);
  console.log(`  Error Rate: ${(results.sequential.stats.errorRate * 100).toFixed(2)}%`);
  console.log(`  Throughput: ${(1000 / results.sequential.stats.responseTimes.avg).toFixed(2)} req/s`);
  
  console.log(chalk.blue('\nConcurrent Requests:'));
  for (const level of CONCURRENCY_LEVELS) {
    const concurrentResults = results.concurrent.find(r => r.concurrencyLevel === level);
    if (concurrentResults) {
      console.log(`  Concurrency Level ${level}:`);
      console.log(`    Total Time: ${concurrentResults.totalTime.toFixed(2)}ms`);
      console.log(`    Memory Usage: ${concurrentResults.memoryUsage.toFixed(2)}MB`);
      console.log(`    Throughput: ${(1000 * level / concurrentResults.totalTime).toFixed(2)} req/s`);
    }
  }
  
  if (comparison.changes) {
    console.log(chalk.blue('\nComparison with Previous Benchmark:'));
    
    const { responseTime, throughput, errorRate, memoryUsage } = comparison.changes;
    
    console.log(`  Response Time: ${responseTime.current}ms (${responseTime.change > 0 ? '+' : ''}${responseTime.change}%)`);
    console.log(`  Throughput: ${throughput.current} req/s (${throughput.change > 0 ? '+' : ''}${throughput.change}%)`);
    console.log(`  Error Rate: ${errorRate.current} (${errorRate.change > 0 ? '+' : ''}${errorRate.change}%)`);
    console.log(`  Memory Usage: ${memoryUsage.current}MB (${memoryUsage.change > 0 ? '+' : ''}${memoryUsage.change}%)`);
  }
}

/**
 * Main benchmark function
 */
async function runBenchmark() {
  console.log(chalk.blue('=== PersLM API Benchmark ==='));
  
  // Initialize benchmark directory
  initBenchmarkDir();
  
  // Get system info
  const systemInfo = getSystemInfo();
  console.log(chalk.blue('System Info:'));
  console.log(`  Platform: ${systemInfo.platform} (${systemInfo.arch})`);
  console.log(`  CPUs: ${systemInfo.cpus}`);
  console.log(`  Memory: ${systemInfo.totalMemory}`);
  console.log(`  Node.js: ${systemInfo.nodeVersion}`);
  
  try {
    // Sequential benchmark
    const sequentialResults = await runSequentialBenchmark();
    const sequentialStats = calculateStats(sequentialResults);
    
    // Concurrent benchmarks
    const concurrentResults = [];
    for (const level of CONCURRENCY_LEVELS) {
      const result = await runConcurrentBenchmark(level);
      concurrentResults.push({
        concurrencyLevel: level,
        ...result,
      });
    }
    
    // Compile results
    const results = {
      system: systemInfo,
      sequential: {
        results: sequentialResults,
        stats: sequentialStats,
      },
      concurrent: concurrentResults,
    };
    
    // Compare with previous benchmark
    const comparison = compareWithPrevious(results);
    
    // Save results
    const { summaryData } = saveBenchmarkResults(results, comparison);
    
    // Print summary
    printBenchmarkSummary(results, comparison);
    
    return summaryData;
  } catch (error) {
    console.error(chalk.red(`Benchmark failed: ${error.message}`));
    console.error(error.stack);
    return null;
  }
}

// Run the benchmark
if (require.main === module) {
  runBenchmark()
    .then(() => {
      console.log(chalk.green('\nBenchmark completed successfully.'));
    })
    .catch(error => {
      console.error(chalk.red(`Benchmark failed with error: ${error.message}`));
      process.exit(1);
    });
} else {
  module.exports = {
    runBenchmark,
  };
} 