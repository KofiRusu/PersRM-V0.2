#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');

// Define paths
const BENCHMARK_DIR = path.join(process.cwd(), 'benchmark-reports');
const ANALYTICS_DIR = path.join(process.cwd(), 'analytics-exports');
const REPORTS_DIR = path.join(process.cwd(), 'reports');
const OUTPUT_DIR = path.join(process.cwd(), 'combined-reports');

// Define CLI options
program
  .description('Generate a combined analytics and benchmark report')
  .option('-b, --benchmarks <dir>', 'Benchmark reports directory', BENCHMARK_DIR)
  .option('-a, --analytics <dir>', 'Analytics exports directory', ANALYTICS_DIR)
  .option('-r, --reports <dir>', 'A/B test reports directory', REPORTS_DIR)
  .option('-o, --output <dir>', 'Output directory', OUTPUT_DIR)
  .option('-t, --title <title>', 'Report title', 'PersLM System Performance Report')
  .option('-p, --pdf', 'Generate PDF report', false)
  .parse(process.argv);

const options = program.opts();

/**
 * Create output directory if it doesn't exist
 */
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(chalk.blue(`Created directory: ${dir}`));
  }
}

/**
 * Get the most recent file from a directory with specified prefix and extension
 */
function getMostRecentFile(directory, prefix, extension) {
  if (!fs.existsSync(directory)) {
    console.log(chalk.yellow(`Directory not found: ${directory}`));
    return null;
  }
  
  const files = fs.readdirSync(directory)
    .filter(file => file.startsWith(prefix) && file.endsWith(extension))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    return null;
  }
  
  return path.join(directory, files[0]);
}

/**
 * Load the most recent benchmark results
 */
function loadBenchmarkResults() {
  const benchmarkFile = getMostRecentFile(options.benchmarks, 'benchmark-', '.json');
  
  if (!benchmarkFile) {
    console.log(chalk.yellow('No benchmark results found'));
    return null;
  }
  
  try {
    console.log(chalk.blue(`Loading benchmark results from ${path.basename(benchmarkFile)}`));
    return JSON.parse(fs.readFileSync(benchmarkFile, 'utf8'));
  } catch (error) {
    console.error(chalk.red(`Error loading benchmark results: ${error.message}`));
    return null;
  }
}

/**
 * Load the most recent A/B test report
 */
function loadABTestReport() {
  const reportFile = getMostRecentFile(options.reports, 'ab-test-report-', '.md');
  
  if (!reportFile) {
    console.log(chalk.yellow('No A/B test report found'));
    return null;
  }
  
  try {
    console.log(chalk.blue(`Loading A/B test report from ${path.basename(reportFile)}`));
    return fs.readFileSync(reportFile, 'utf8');
  } catch (error) {
    console.error(chalk.red(`Error loading A/B test report: ${error.message}`));
    return null;
  }
}

/**
 * Load analytics data
 */
function loadAnalyticsData() {
  const analyticsFile = getMostRecentFile(options.analytics, 'analytics-export-', '.json');
  
  if (!analyticsFile) {
    console.log(chalk.yellow('No analytics data found'));
    return null;
  }
  
  try {
    console.log(chalk.blue(`Loading analytics data from ${path.basename(analyticsFile)}`));
    return JSON.parse(fs.readFileSync(analyticsFile, 'utf8'));
  } catch (error) {
    console.error(chalk.red(`Error loading analytics data: ${error.message}`));
    return null;
  }
}

/**
 * Convert Markdown to HTML
 */
function markdownToHtml(markdown) {
  try {
    // Try to use the marked package if it's installed
    try {
      const marked = require('marked');
      return marked.parse(markdown);
    } catch (e) {
      // Fallback to a simple conversion
      return markdown
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
    }
  } catch (error) {
    console.error(chalk.red(`Error converting markdown to HTML: ${error.message}`));
    return `<pre>${markdown}</pre>`;
  }
}

/**
 * Generate benchmark summary HTML
 */
function generateBenchmarkSummary(benchmarkData) {
  if (!benchmarkData || !benchmarkData.summary) {
    return '<p>No benchmark data available</p>';
  }
  
  const { responseTime, throughput, errorRate, memoryUsage } = benchmarkData.summary;
  
  return `
<div class="card mb-4">
  <div class="card-header">
    <h2 class="h5 mb-0">Performance Benchmarks</h2>
  </div>
  <div class="card-body">
    <div class="row">
      <div class="col-md-6">
        <h3 class="h6">Sequential Performance</h3>
        <table class="table table-sm">
          <tbody>
            <tr>
              <td>Average Response Time</td>
              <td>${responseTime.current}ms ${responseTime.change ? `(${responseTime.change > 0 ? '+' : ''}${responseTime.change}%)` : ''}</td>
            </tr>
            <tr>
              <td>Throughput</td>
              <td>${throughput.current} req/s ${throughput.change ? `(${throughput.change > 0 ? '+' : ''}${throughput.change}%)` : ''}</td>
            </tr>
            <tr>
              <td>Error Rate</td>
              <td>${errorRate.current} ${errorRate.change ? `(${errorRate.change > 0 ? '+' : ''}${errorRate.change}%)` : ''}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="col-md-6">
        <h3 class="h6">Concurrent Performance</h3>
        <table class="table table-sm">
          <tbody>
            <tr>
              <td>Memory Usage</td>
              <td>${memoryUsage.current}MB ${memoryUsage.change ? `(${memoryUsage.change > 0 ? '+' : ''}${memoryUsage.change}%)` : ''}</td>
            </tr>
            ${benchmarkData.concurrent && benchmarkData.concurrent.length > 0 ? 
              benchmarkData.concurrent.map(c => `
                <tr>
                  <td>Concurrency Level ${c.concurrencyLevel}</td>
                  <td>${(1000 * c.concurrencyLevel / c.totalTime).toFixed(2)} req/s</td>
                </tr>
              `).join('') : ''}
          </tbody>
        </table>
      </div>
    </div>
    <div class="row mt-3">
      <div class="col-12">
        <div style="height: 300px">
          <canvas id="benchmarkChart"></canvas>
        </div>
      </div>
    </div>
  </div>
</div>
  `;
}

/**
 * Generate analytics summary HTML
 */
function generateAnalyticsSummary(analyticsData) {
  if (!analyticsData) {
    return '<p>No analytics data available</p>';
  }
  
  const requestsByDate = analyticsData.requestsByDate || {};
  const dates = Object.keys(requestsByDate).sort();
  const counts = dates.map(date => requestsByDate[date]);
  
  return `
<div class="card mb-4">
  <div class="card-header">
    <h2 class="h5 mb-0">Usage Analytics</h2>
  </div>
  <div class="card-body">
    <div class="row">
      <div class="col-md-4">
        <div class="stat-card text-center p-3 mb-3">
          <div class="h1">${analyticsData.totalRequests?.toLocaleString() || 0}</div>
          <div class="text-muted">Total Requests</div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="stat-card text-center p-3 mb-3">
          <div class="h1">${analyticsData.sessionStats?.count?.toLocaleString() || 0}</div>
          <div class="text-muted">User Sessions</div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="stat-card text-center p-3 mb-3">
          <div class="h1">${analyticsData.errorRate?.toFixed(1) || 0}%</div>
          <div class="text-muted">Error Rate</div>
        </div>
      </div>
    </div>
    
    <div class="row mt-3">
      <div class="col-md-6">
        <h3 class="h6">Response Time (ms)</h3>
        <table class="table table-sm">
          <tbody>
            <tr>
              <td>Average</td>
              <td>${analyticsData.responseTimeStats?.avg?.toFixed(0) || 'N/A'}</td>
            </tr>
            <tr>
              <td>Median</td>
              <td>${analyticsData.responseTimeStats?.median?.toFixed(0) || 'N/A'}</td>
            </tr>
            <tr>
              <td>95th Percentile</td>
              <td>${analyticsData.responseTimeStats?.p95?.toFixed(0) || 'N/A'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="col-md-6">
        <h3 class="h6">Request Types</h3>
        <table class="table table-sm">
          <tbody>
            ${analyticsData.requestsByType ? 
              Object.entries(analyticsData.requestsByType).map(([type, count]) => `
                <tr>
                  <td>${type}</td>
                  <td>${count} (${((count / analyticsData.totalRequests) * 100).toFixed(1)}%)</td>
                </tr>
              `).join('') : ''}
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="row mt-3">
      <div class="col-12">
        <div style="height: 300px">
          <canvas id="usageChart"></canvas>
        </div>
      </div>
    </div>
  </div>
</div>
  `;
}

/**
 * Generate HTML report
 */
function generateHtmlReport(data, title) {
  const { benchmarkData, analyticsData, abTestReport } = data;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
    .card { box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .card-header { font-weight: bold; background-color: #f8f9fa; }
    .stat-card { background-color: #f8f9fa; border-radius: 5px; }
    .report-section { margin-bottom: 30px; }
    @media print {
      body { padding: 0; }
      .card { box-shadow: none; border: 1px solid #ddd; }
      .page-break { page-break-after: always; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="row mb-4">
      <div class="col">
        <h1>${title}</h1>
        <p class="text-muted">Generated on ${new Date().toLocaleString()}</p>
      </div>
    </div>

    <div class="row mb-4">
      <div class="col">
        <div class="card">
          <div class="card-header">
            <h2 class="h5 mb-0">Executive Summary</h2>
          </div>
          <div class="card-body">
            <p>This report combines performance benchmarks, A/B test results, and usage analytics for the PersLM reasoning system.</p>
            
            <h3 class="h6 mt-3">Key Findings:</h3>
            <ul>
              ${benchmarkData ? `<li>Average API response time: <strong>${benchmarkData.summary.responseTime.current}ms</strong></li>` : ''}
              ${analyticsData ? `<li>Total requests processed: <strong>${analyticsData.totalRequests.toLocaleString()}</strong></li>` : ''}
              ${analyticsData && analyticsData.sessionStats ? `<li>User sessions: <strong>${analyticsData.sessionStats.count.toLocaleString()}</strong></li>` : ''}
              ${abTestReport ? `<li>A/B testing completed with conclusive results</li>` : ''}
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="report-section">
      ${benchmarkData ? generateBenchmarkSummary(benchmarkData) : '<p>No benchmark data available</p>'}
    </div>

    <div class="report-section">
      ${analyticsData ? generateAnalyticsSummary(analyticsData) : '<p>No analytics data available</p>'}
    </div>

    ${abTestReport ? `
      <div class="report-section page-break">
        <div class="card mb-4">
          <div class="card-header">
            <h2 class="h5 mb-0">A/B Test Results</h2>
          </div>
          <div class="card-body">
            ${markdownToHtml(abTestReport)}
          </div>
        </div>
      </div>
    ` : ''}
  </div>

  <script>
    // Initialize charts if data is available
    ${benchmarkData ? `
      // Benchmark chart
      new Chart(document.getElementById('benchmarkChart'), {
        type: 'bar',
        data: {
          labels: ['Response Time', 'Throughput', 'Error Rate', 'Memory Usage'],
          datasets: [{
            label: 'Current',
            data: [
              ${parseFloat(benchmarkData.summary.responseTime.current) || 0},
              ${parseFloat(benchmarkData.summary.throughput.current) || 0},
              ${parseFloat(benchmarkData.summary.errorRate.current) || 0},
              ${parseFloat(benchmarkData.summary.memoryUsage.current) || 0}
            ],
            backgroundColor: 'rgba(54, 162, 235, 0.6)'
          }${benchmarkData.comparison ? `, {
            label: 'Previous',
            data: [
              ${parseFloat(benchmarkData.summary.responseTime.previous) || 0},
              ${parseFloat(benchmarkData.summary.throughput.previous) || 0},
              ${parseFloat(benchmarkData.summary.errorRate.previous) || 0},
              ${parseFloat(benchmarkData.summary.memoryUsage.previous) || 0}
            ],
            backgroundColor: 'rgba(255, 99, 132, 0.6)'
          }` : ''}]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Value (normalized)'
              }
            }
          }
        }
      });
    ` : ''}

    ${analyticsData && analyticsData.requestsByDate ? `
      // Usage chart
      new Chart(document.getElementById('usageChart'), {
        type: 'line',
        data: {
          labels: ${JSON.stringify(Object.keys(analyticsData.requestsByDate).sort())},
          datasets: [{
            label: 'Daily Requests',
            data: ${JSON.stringify(Object.keys(analyticsData.requestsByDate).sort().map(date => analyticsData.requestsByDate[date]))},
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            tension: 0.3,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Number of Requests'
              }
            }
          }
        }
      });
    ` : ''}
  </script>
</body>
</html>
  `;
}

/**
 * Generate PDF from HTML using puppeteer
 */
async function generatePdf(htmlPath, outputPath) {
  console.log(chalk.blue('Generating PDF report...'));
  
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Load HTML file
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });
    
    await browser.close();
    console.log(chalk.green(`PDF report generated at ${outputPath}`));
  } catch (error) {
    console.error(chalk.red(`Error generating PDF: ${error.message}`));
  }
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.blue('=== PersLM Combined Report Generator ==='));
  
  // Ensure output directory exists
  ensureDirectoryExists(options.output);
  
  // Load data from different sources
  const benchmarkData = loadBenchmarkResults();
  const abTestReport = loadABTestReport();
  const analyticsData = loadAnalyticsData();
  
  if (!benchmarkData && !abTestReport && !analyticsData) {
    console.error(chalk.red('No data found to generate report'));
    process.exit(1);
  }
  
  // Generate HTML report
  const timestamp = new Date().toISOString().replace(/[:T.]/g, '-').slice(0, 19);
  const htmlPath = path.join(options.output, `combined-report-${timestamp}.html`);
  
  const htmlContent = generateHtmlReport({
    benchmarkData,
    analyticsData,
    abTestReport
  }, options.title);
  
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(chalk.green(`HTML report generated at ${htmlPath}`));
  
  // Generate PDF if requested
  if (options.pdf) {
    try {
      // Check if puppeteer is installed
      require.resolve('puppeteer');
      
      const pdfPath = path.join(options.output, `combined-report-${timestamp}.pdf`);
      await generatePdf(htmlPath, pdfPath);
    } catch (error) {
      console.log(chalk.yellow('Could not generate PDF report.'));
      console.log(chalk.yellow('To enable PDF generation, install puppeteer: npm install puppeteer'));
    }
  }
  
  console.log(chalk.green('\nReport generation complete!'));
}

// Run the script
main().catch(error => {
  console.error(chalk.red(`Error generating report: ${error.message}`));
  console.error(error.stack);
  process.exit(1);
}); 