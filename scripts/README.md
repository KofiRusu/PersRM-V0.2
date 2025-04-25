# PersLM Analytics System

This directory contains a suite of analytics, benchmark, and reporting tools for the PersLM reasoning system. These tools help track performance, usage patterns, and A/B test results.

## Available Scripts

### Benchmarking

- **run-benchmarks.js**: Comprehensive API benchmarking tool that tests various endpoints with different concurrency levels
- **benchmark.js**: Focused reasoning API benchmark with detailed statistics

### Analytics

- **export-analytics.js**: Exports analytics data from log files into CSV or JSON formats
- **analyze-ab-test.js**: Analyzes A/B test results to determine the best animation variants
- **generate-dashboard.js**: Creates an interactive HTML dashboard from analytics data

### Reporting

- **generate-report.js**: Combines benchmark results, analytics data, and A/B test reports into a comprehensive HTML/PDF report
- **run-all-analytics.sh**: Master script that runs all the analytics tools in sequence

### Database Utilities

- **db-setup.js**: Interactive utility for switching between SQLite and PostgreSQL configurations
- **test-db-connection.js**: Tests database connectivity and basic operations
- **json-utils.ts**: Utility functions for handling JSON data with SQLite

## Usage

### Running Individual Scripts

Each script can be run individually with custom parameters:

```bash
# Run system benchmarks
node scripts/run-benchmarks.js

# Run focused reasoning API benchmark
node scripts/benchmark.js

# Export analytics data
node scripts/export-analytics.js --since 2023-01-01 --until 2023-01-31 --format csv

# Analyze A/B tests
node scripts/analyze-ab-test.js

# Generate an analytics dashboard
node scripts/generate-dashboard.js

# Generate a combined report
node scripts/generate-report.js --pdf

# Set up database configuration
node scripts/db-setup.js

# Test database connection
node scripts/test-db-connection.js
```

### Running the Full Suite

To run all analytics tools in sequence:

```bash
# Run all tools
./scripts/run-all-analytics.sh

# Run all tools and generate PDF reports
./scripts/run-all-analytics.sh --with-pdf
```

## Generated Output

The scripts generate various reports and data files in the following directories:

- `benchmark-reports/`: Benchmark results in JSON format
- `analytics-exports/`: Exported analytics data in CSV/JSON format
- `reports/`: A/B test analysis reports in Markdown format
- `dashboard/`: Interactive HTML dashboard
- `combined-reports/`: Comprehensive HTML/PDF reports

## Database Configuration

The system supports both SQLite (default for development) and PostgreSQL (recommended for production) databases:

- **SQLite**: Simple setup, no additional dependencies, but limited JSON support
- **PostgreSQL**: Full JSON field support, better for larger datasets and analytics

Use `db-setup.js` to switch between database providers or see `docs/prisma-db-config.md` for detailed instructions.

## Dependencies

These scripts have the following dependencies:

```
npm install commander chalk puppeteer json2csv marked chart.js
```

Some scripts have optional dependencies:
- `puppeteer`: Required for PDF generation
- `marked`: Optional for better Markdown to HTML conversion

## Adding New Analytics Features

To extend the analytics system:

1. Add new log collection points in the application code using the `retentionService`
2. Update `export-analytics.js` to include new data fields
3. Enhance the dashboard in `generate-dashboard.js` to visualize the new data
4. Update the combined report in `generate-report.js` to include the new metrics

## Automating Analytics Collection

For automated analytics:

1. Set up a cron job to run `run-all-analytics.sh` at regular intervals
2. Configure a storage solution for long-term metrics retention
3. Implement alerts for performance degradation or error rate increases 