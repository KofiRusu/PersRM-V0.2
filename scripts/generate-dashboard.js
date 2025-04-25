#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');

// Define paths
const ANALYTICS_DIR = path.join(process.cwd(), 'analytics-exports');
const DASHBOARD_DIR = path.join(process.cwd(), 'dashboard');

// Define CLI options
program
  .description('Generate an HTML dashboard from analytics data')
  .option('-i, --input <dir>', 'Input directory with analytics exports', ANALYTICS_DIR)
  .option('-o, --output <dir>', 'Output directory for dashboard', DASHBOARD_DIR)
  .option('-t, --title <title>', 'Dashboard title', 'PersLM Analytics Dashboard')
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
 * Get the most recent analytics export files
 */
function getLatestAnalyticsFiles(inputDir) {
  if (!fs.existsSync(inputDir)) {
    console.error(chalk.red(`Input directory not found: ${inputDir}`));
    return null;
  }
  
  // Look for analytics export files
  const analyticsFile = fs.readdirSync(inputDir)
    .filter(file => file.startsWith('analytics-export-') && file.endsWith('.json'))
    .sort()
    .pop();
    
  const recordsFile = fs.readdirSync(inputDir)
    .filter(file => file.startsWith('records-export-') && file.endsWith('.json'))
    .sort()
    .pop();
    
  if (!analyticsFile || !recordsFile) {
    console.error(chalk.red('Could not find required analytics export files'));
    return null;
  }
  
  return {
    analytics: path.join(inputDir, analyticsFile),
    records: path.join(inputDir, recordsFile)
  };
}

/**
 * Load data from analytics files
 */
function loadAnalyticsData(files) {
  try {
    const analytics = JSON.parse(fs.readFileSync(files.analytics, 'utf8'));
    const records = JSON.parse(fs.readFileSync(files.records, 'utf8'));
    
    return { analytics, records };
  } catch (error) {
    console.error(chalk.red(`Error loading analytics data: ${error.message}`));
    return null;
  }
}

/**
 * Generate usage timeline data for charts
 */
function generateTimelineData(analytics) {
  const dates = Object.keys(analytics.requestsByDate).sort();
  const data = dates.map(date => ({
    date,
    count: analytics.requestsByDate[date]
  }));
  
  return { dates, data };
}

/**
 * Generate type distribution data for charts
 */
function generateTypeDistribution(analytics) {
  const types = Object.keys(analytics.requestsByType);
  const data = types.map(type => ({
    type,
    count: analytics.requestsByType[type]
  }));
  
  return data;
}

/**
 * Generate session data insights
 */
function generateSessionInsights(analytics, records) {
  // Group records by session
  const sessions = {};
  records.forEach(record => {
    if (record.sessionId) {
      if (!sessions[record.sessionId]) {
        sessions[record.sessionId] = [];
      }
      sessions[record.sessionId].push(record);
    }
  });
  
  // Calculate average number of queries per hour of the day
  const queriesByHour = Array(24).fill(0);
  const countsByHour = Array(24).fill(0);
  
  records.forEach(record => {
    if (record.timestamp) {
      const hour = new Date(record.timestamp).getHours();
      queriesByHour[hour]++;
      countsByHour[hour]++;
    }
  });
  
  return {
    totalSessions: Object.keys(sessions).length,
    averageSessionLength: analytics.sessionStats.averageDuration,
    averageQueriesPerSession: analytics.sessionStats.averageQueriesPerSession,
    queriesByHour: queriesByHour.map((count, hour) => ({
      hour,
      count
    }))
  };
}

/**
 * Generate error analysis data
 */
function generateErrorAnalysis(records) {
  const errors = records.filter(record => record.error);
  
  // Group errors by type
  const errorsByType = {};
  errors.forEach(error => {
    const type = error.errorMessage || 'Unknown error';
    errorsByType[type] = (errorsByType[type] || 0) + 1;
  });
  
  return {
    totalErrors: errors.length,
    errorRate: (errors.length / records.length) * 100,
    topErrors: Object.entries(errorsByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }))
  };
}

/**
 * Generate HTML dashboard
 */
function generateDashboard(data, title) {
  const { analytics, timeline, typeDistribution, sessionInsights, errorAnalysis } = data;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/luxon@3.0.1/build/global/luxon.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-luxon@1.2.0/dist/chartjs-adapter-luxon.min.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
    .card { margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .card-header { font-weight: bold; background-color: #f8f9fa; }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { font-size: 14px; color: #6c757d; }
    .chart-container { position: relative; height: 300px; width: 100%; }
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

    <!-- Summary Stats -->
    <div class="row mb-4">
      <div class="col-md-3">
        <div class="card">
          <div class="card-body text-center">
            <div class="stat-value">${analytics.totalRequests.toLocaleString()}</div>
            <div class="stat-label">Total Requests</div>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card">
          <div class="card-body text-center">
            <div class="stat-value">${sessionInsights.totalSessions.toLocaleString()}</div>
            <div class="stat-label">Total Sessions</div>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card">
          <div class="card-body text-center">
            <div class="stat-value">${analytics.responseTimeStats.avg.toFixed(0)} ms</div>
            <div class="stat-label">Avg Response Time</div>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card">
          <div class="card-body text-center">
            <div class="stat-value">${errorAnalysis.errorRate.toFixed(1)}%</div>
            <div class="stat-label">Error Rate</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Usage Trends -->
    <div class="row mb-4">
      <div class="col-md-8">
        <div class="card">
          <div class="card-header">Daily Usage</div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="usageChart"></canvas>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card">
          <div class="card-header">Request Types</div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="typesChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Session Insights -->
    <div class="row mb-4">
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">Session Insights</div>
          <div class="card-body">
            <table class="table">
              <tbody>
                <tr>
                  <td>Average Session Duration</td>
                  <td>${(sessionInsights.averageSessionLength / 60).toFixed(2)} minutes</td>
                </tr>
                <tr>
                  <td>Average Queries per Session</td>
                  <td>${sessionInsights.averageQueriesPerSession.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Max Queries in a Session</td>
                  <td>${analytics.sessionStats.maxQueriesInSession}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">Usage by Hour of Day</div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="hourlyChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Top Queries and Errors -->
    <div class="row">
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">Top Queries</div>
          <div class="card-body">
            <table class="table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                ${analytics.topQueries.slice(0, 5).map(query => `
                  <tr>
                    <td>${query.query.substring(0, 50)}${query.query.length > 50 ? '...' : ''}</td>
                    <td>${query.count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">Top Errors</div>
          <div class="card-body">
            ${errorAnalysis.totalErrors > 0 ? `
              <table class="table">
                <thead>
                  <tr>
                    <th>Error</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  ${errorAnalysis.topErrors.map(error => `
                    <tr>
                      <td>${error.message.substring(0, 50)}${error.message.length > 50 ? '...' : ''}</td>
                      <td>${error.count}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `<p class="text-center mt-3">No errors reported</p>`}
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Usage Timeline Chart
    new Chart(document.getElementById('usageChart'), {
      type: 'line',
      data: {
        datasets: [{
          label: 'Daily Requests',
          data: ${JSON.stringify(timeline.data)},
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
            type: 'time',
            time: {
              unit: 'day',
              tooltipFormat: 'yyyy-MM-dd'
            },
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Number of Requests'
            },
            beginAtZero: true
          }
        },
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    });

    // Request Types Chart
    new Chart(document.getElementById('typesChart'), {
      type: 'doughnut',
      data: {
        labels: ${JSON.stringify(typeDistribution.map(item => item.type))},
        datasets: [{
          data: ${JSON.stringify(typeDistribution.map(item => item.count))},
          backgroundColor: [
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          }
        }
      }
    });

    // Hourly Usage Chart
    new Chart(document.getElementById('hourlyChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(sessionInsights.queriesByHour.map(item => item.hour))},
        datasets: [{
          label: 'Queries by Hour',
          data: ${JSON.stringify(sessionInsights.queriesByHour.map(item => item.count))},
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgb(54, 162, 235)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Hour of Day'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Queries'
            }
          }
        }
      }
    });
  </script>
</body>
</html>
  `;
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.blue('=== PersLM Analytics Dashboard Generator ==='));
  
  // Ensure output directory exists
  ensureDirectoryExists(options.output);
  
  // Get latest analytics files
  const files = getLatestAnalyticsFiles(options.input);
  if (!files) {
    process.exit(1);
  }
  
  console.log(chalk.blue(`Using analytics files:`));
  console.log(`  Analytics: ${path.basename(files.analytics)}`);
  console.log(`  Records: ${path.basename(files.records)}`);
  
  // Load analytics data
  const data = loadAnalyticsData(files);
  if (!data) {
    process.exit(1);
  }
  
  console.log(chalk.blue(`Loaded data for ${data.analytics.totalRequests} requests`));
  
  // Generate timeline data
  const timeline = generateTimelineData(data.analytics);
  
  // Generate type distribution data
  const typeDistribution = generateTypeDistribution(data.analytics);
  
  // Generate session insights
  const sessionInsights = generateSessionInsights(data.analytics, data.records);
  
  // Generate error analysis
  const errorAnalysis = generateErrorAnalysis(data.records);
  
  // Generate and save the dashboard
  const dashboardHtml = generateDashboard({
    analytics: data.analytics,
    timeline,
    typeDistribution,
    sessionInsights,
    errorAnalysis
  }, options.title);
  
  const outputPath = path.join(options.output, 'index.html');
  fs.writeFileSync(outputPath, dashboardHtml);
  
  console.log(chalk.green(`\nDashboard generated successfully at ${outputPath}`));
  console.log(chalk.yellow(`\nOpen the dashboard in your browser to view it`));
}

// Run the script
main().catch(error => {
  console.error(chalk.red(`Error generating dashboard: ${error.message}`));
  console.error(error.stack);
  process.exit(1);
}); 