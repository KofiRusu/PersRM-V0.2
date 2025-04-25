#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { program } = require('commander');
const chalk = require('chalk');
const { Parser } = require('json2csv');

const LOG_DIR = path.join(process.cwd(), 'logs');
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'analytics-exports');

// Define CLI options
program
  .description('Export analytics data from reasoning-log files')
  .option('-s, --since <date>', 'Export data since date (YYYY-MM-DD)', getDefaultStartDate())
  .option('-u, --until <date>', 'Export data until date (YYYY-MM-DD)', getTomorrowDate())
  .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT_DIR)
  .option('-f, --format <format>', 'Output format (csv, json)', 'csv')
  .option('-q, --query <type>', 'Filter by query type (reasoning, codegen, route)', '')
  .parse(process.argv);

const options = program.opts();

/**
 * Get default start date (7 days ago)
 */
function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
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
    .filter(file => file.startsWith('reasoning-log-') && file.endsWith('.jsonl'))
    .sort();

  // Filter by date range if specified
  const sinceDate = new Date(since);
  const untilDate = new Date(until);

  return files.filter(file => {
    // Extract date from filename (reasoning-log-YYYY-MM-DD.jsonl)
    const datePart = file.replace('reasoning-log-', '').replace('.jsonl', '');
    const fileDate = new Date(datePart);
    return fileDate >= sinceDate && fileDate <= untilDate;
  }).map(file => path.join(LOG_DIR, file));
}

/**
 * Process log files and extract analytics data
 */
async function processLogFiles(files, queryFilter = '') {
  const records = [];

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
        
        // Apply query filter if specified
        if (queryFilter && record.type !== queryFilter) {
          continue;
        }
        
        // Add to records
        records.push(record);
      } catch (error) {
        console.error(chalk.red(`Error parsing line: ${error.message}`));
      }
    }
  }

  return records;
}

/**
 * Generate analytics from records
 */
function generateAnalytics(records) {
  const analytics = {
    totalRequests: records.length,
    requestsByDate: {},
    requestsByType: {},
    requestsByModel: {},
    responseTimeStats: calculateResponseTimeStats(records),
    sessionStats: calculateSessionStats(records),
    errorRate: 0,
    topQueries: getTopQueries(records, 10),
    exportTimestamp: new Date().toISOString(),
  };

  // Count requests by date
  records.forEach(record => {
    const date = record.timestamp.split('T')[0];
    analytics.requestsByDate[date] = (analytics.requestsByDate[date] || 0) + 1;
    
    // Count by type
    analytics.requestsByType[record.type] = (analytics.requestsByType[record.type] || 0) + 1;
    
    // Count by model
    if (record.model) {
      analytics.requestsByModel[record.model] = (analytics.requestsByModel[record.model] || 0) + 1;
    }
    
    // Count errors
    if (record.error) {
      analytics.errorRate++;
    }
  });

  // Calculate error rate percentage
  analytics.errorRate = (analytics.errorRate / analytics.totalRequests) * 100;

  return analytics;
}

/**
 * Calculate response time statistics
 */
function calculateResponseTimeStats(records) {
  const times = records
    .filter(record => record.duration && !record.error)
    .map(record => record.duration);
  
  if (times.length === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      median: 0,
      p90: 0,
      p95: 0,
    };
  }
  
  return {
    min: Math.min(...times),
    max: Math.max(...times),
    avg: times.reduce((sum, time) => sum + time, 0) / times.length,
    median: calculatePercentile(times, 50),
    p90: calculatePercentile(times, 90),
    p95: calculatePercentile(times, 95),
  };
}

/**
 * Calculate session statistics
 */
function calculateSessionStats(records) {
  const sessions = {};
  
  // Group records by session
  records.forEach(record => {
    if (record.sessionId) {
      if (!sessions[record.sessionId]) {
        sessions[record.sessionId] = {
          records: [],
          startTime: record.timestamp,
          endTime: record.timestamp,
        };
      }
      
      sessions[record.sessionId].records.push(record);
      
      // Update session end time if this record is newer
      if (new Date(record.timestamp) > new Date(sessions[record.sessionId].endTime)) {
        sessions[record.sessionId].endTime = record.timestamp;
      }
    }
  });
  
  // Calculate session durations
  const sessionIds = Object.keys(sessions);
  const sessionDurations = sessionIds.map(sessionId => {
    const session = sessions[sessionId];
    const startTime = new Date(session.startTime);
    const endTime = new Date(session.endTime);
    return (endTime - startTime) / 1000; // in seconds
  });
  
  // Calculate queries per session
  const queriesPerSession = sessionIds.map(sessionId => sessions[sessionId].records.length);
  
  return {
    count: sessionIds.length,
    averageDuration: sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length,
    averageQueriesPerSession: queriesPerSession.reduce((sum, count) => sum + count, 0) / queriesPerSession.length,
    maxQueriesInSession: Math.max(...queriesPerSession),
  };
}

/**
 * Get top N queries by frequency
 */
function getTopQueries(records, n = 10) {
  const queryCount = {};
  
  records.forEach(record => {
    if (record.question) {
      queryCount[record.question] = (queryCount[record.question] || 0) + 1;
    }
  });
  
  return Object.entries(queryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([query, count]) => ({ query, count }));
}

/**
 * Calculate percentile for an array of numbers
 */
function calculatePercentile(array, percentile) {
  const sorted = [...array].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

/**
 * Export analytics to a file
 */
function exportAnalytics(analytics, outputDir, format = 'csv') {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `analytics-export-${timestamp}.${format}`;
  const filepath = path.join(outputDir, filename);
  
  if (format === 'json') {
    fs.writeFileSync(filepath, JSON.stringify(analytics, null, 2));
  } else if (format === 'csv') {
    // Flatten the data for CSV export
    const flatRecords = analytics.records.map(record => {
      // Handle nested objects for CSV export
      return {
        timestamp: record.timestamp,
        type: record.type,
        question: record.question,
        duration: record.duration,
        model: record.model,
        sessionId: record.sessionId,
        error: record.error ? 'true' : 'false',
        errorMessage: record.error ? record.errorMessage : '',
      };
    });
    
    // Convert to CSV
    const parser = new Parser();
    const csv = parser.parse(flatRecords);
    fs.writeFileSync(filepath, csv);
  }
  
  console.log(chalk.green(`Analytics exported to ${filepath}`));
  return filepath;
}

/**
 * Export raw records to a file
 */
function exportRawRecords(records, outputDir, format = 'csv') {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `records-export-${timestamp}.${format}`;
  const filepath = path.join(outputDir, filename);
  
  if (format === 'json') {
    fs.writeFileSync(filepath, JSON.stringify(records, null, 2));
  } else if (format === 'csv') {
    // Prepare records for CSV by flattening nested objects
    const flatRecords = records.map(record => {
      const flatRecord = { ...record };
      // Remove potentially complex objects that would make CSV difficult
      delete flatRecord.structured;
      delete flatRecord.sections;
      delete flatRecord.generatedCode;
      
      return flatRecord;
    });
    
    // Convert to CSV
    const parser = new Parser();
    const csv = parser.parse(flatRecords);
    fs.writeFileSync(filepath, csv);
  }
  
  console.log(chalk.green(`Raw records exported to ${filepath}`));
  return filepath;
}

/**
 * Print analytics summary to console
 */
function printAnalyticsSummary(analytics) {
  console.log('\n' + chalk.blue('=== Analytics Summary ==='));
  console.log(`Total Requests: ${analytics.totalRequests}`);
  console.log(`Error Rate: ${analytics.errorRate.toFixed(2)}%`);
  console.log(`Date Range: ${Object.keys(analytics.requestsByDate).sort()[0]} to ${Object.keys(analytics.requestsByDate).sort().pop()}`);
  
  console.log('\nRequests by Type:');
  Object.entries(analytics.requestsByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} (${((count / analytics.totalRequests) * 100).toFixed(2)}%)`);
  });
  
  console.log('\nResponse Time:');
  console.log(`  Average: ${analytics.responseTimeStats.avg.toFixed(2)}ms`);
  console.log(`  Median: ${analytics.responseTimeStats.median.toFixed(2)}ms`);
  console.log(`  95th Percentile: ${analytics.responseTimeStats.p95.toFixed(2)}ms`);
  
  console.log('\nSessions:');
  console.log(`  Total Sessions: ${analytics.sessionStats.count}`);
  console.log(`  Avg. Duration: ${(analytics.sessionStats.averageDuration / 60).toFixed(2)} minutes`);
  console.log(`  Avg. Queries/Session: ${analytics.sessionStats.averageQueriesPerSession.toFixed(2)}`);
  
  console.log('\nTop Queries:');
  analytics.topQueries.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}. "${item.query.substring(0, 50)}${item.query.length > 50 ? '...' : ''}" (${item.count} times)`);
  });
}

/**
 * Main function
 */
async function main() {
  const { since, until, output, format, query } = options;
  
  console.log(chalk.blue(`=== PersLM Analytics Export ===`));
  console.log(`Date Range: ${since} to ${until}`);
  if (query) {
    console.log(`Query Filter: ${query}`);
  }
  
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
  const records = await processLogFiles(files, query);
  
  if (records.length === 0) {
    console.log(chalk.yellow(`No records found in the specified date range and filter.`));
    return;
  }
  
  console.log(chalk.blue(`Processed ${records.length} records.`));
  
  // Generate analytics
  const analytics = generateAnalytics(records);
  
  // Add raw records to analytics
  analytics.records = records;
  
  // Print summary
  printAnalyticsSummary(analytics);
  
  // Export analytics
  exportAnalytics(analytics, output, format);
  
  // Export raw records
  exportRawRecords(records, output, format);
  
  console.log(chalk.green('\nAnalytics export completed successfully.'));
}

// Run the script
main().catch(error => {
  console.error(chalk.red(`Export failed with error: ${error.message}`));
  console.error(error.stack);
  process.exit(1);
}); 