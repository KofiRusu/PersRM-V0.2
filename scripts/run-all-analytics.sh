#!/bin/bash

# Run all analytics and benchmark scripts in sequence
# Usage: ./run-all-analytics.sh [--with-pdf]

# Set colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check for PDF generation option
GENERATE_PDF=false
if [ "$1" == "--with-pdf" ]; then
  GENERATE_PDF=true
fi

# Set timestamp for reports
TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")
echo -e "${BLUE}=== PersLM Analytics Suite ===${NC}"
echo -e "${BLUE}Starting analytics run: ${TIMESTAMP}${NC}"

# Create output directories
mkdir -p benchmark-reports
mkdir -p analytics-exports
mkdir -p reports
mkdir -p dashboard
mkdir -p combined-reports

# Step 1: Run system benchmarks
echo -e "\n${BLUE}Step 1: Running system benchmarks...${NC}"
node scripts/run-benchmarks.js
if [ $? -ne 0 ]; then
  echo -e "${RED}Benchmark failed. Continuing with other steps...${NC}"
fi

# Step 2: Run benchmark for reasoning API
echo -e "\n${BLUE}Step 2: Running reasoning API benchmarks...${NC}"
node scripts/benchmark.js
if [ $? -ne 0 ]; then
  echo -e "${RED}Reasoning API benchmark failed. Continuing with other steps...${NC}"
fi

# Step 3: Analyze A/B tests
echo -e "\n${BLUE}Step 3: Analyzing A/B test results...${NC}"
node scripts/analyze-ab-test.js
if [ $? -ne 0 ]; then
  echo -e "${RED}A/B test analysis failed. Continuing with other steps...${NC}"
fi

# Step 4: Export analytics data
echo -e "\n${BLUE}Step 4: Exporting analytics data...${NC}"
node scripts/export-analytics.js
if [ $? -ne 0 ]; then
  echo -e "${RED}Analytics export failed. Continuing with other steps...${NC}"
fi

# Step 5: Generate dashboard
echo -e "\n${BLUE}Step 5: Generating analytics dashboard...${NC}"
node scripts/generate-dashboard.js
if [ $? -ne 0 ]; then
  echo -e "${RED}Dashboard generation failed. Continuing with other steps...${NC}"
fi

# Step 6: Generate combined report
echo -e "\n${BLUE}Step 6: Generating combined report...${NC}"
if [ "$GENERATE_PDF" = true ]; then
  echo -e "${YELLOW}Generating report with PDF export...${NC}"
  node scripts/generate-report.js --pdf
else
  node scripts/generate-report.js
fi

if [ $? -ne 0 ]; then
  echo -e "${RED}Report generation failed.${NC}"
  exit 1
fi

# Open the dashboard and report if xdg-open (Linux), open (Mac), or start (Windows) is available
echo -e "\n${BLUE}Opening reports in browser...${NC}"
DASHBOARD_PATH="dashboard/index.html"
REPORT_PATH=$(ls -t combined-reports/combined-report-*.html | head -1)

if [ -f "$DASHBOARD_PATH" ]; then
  if command -v xdg-open &> /dev/null; then
    xdg-open "$DASHBOARD_PATH" &
  elif command -v open &> /dev/null; then
    open "$DASHBOARD_PATH"
  elif command -v start &> /dev/null; then
    start "$DASHBOARD_PATH"
  else
    echo -e "${YELLOW}Could not open dashboard automatically. Please open ${DASHBOARD_PATH} manually.${NC}"
  fi
else
  echo -e "${YELLOW}Dashboard file not found.${NC}"
fi

if [ -f "$REPORT_PATH" ]; then
  if command -v xdg-open &> /dev/null; then
    xdg-open "$REPORT_PATH" &
  elif command -v open &> /dev/null; then
    open "$REPORT_PATH"
  elif command -v start &> /dev/null; then
    start "$REPORT_PATH"
  else
    echo -e "${YELLOW}Could not open report automatically. Please open ${REPORT_PATH} manually.${NC}"
  fi
else
  echo -e "${YELLOW}Report file not found.${NC}"
fi

echo -e "\n${GREEN}All analytics processes completed!${NC}"
echo -e "${BLUE}Dashboard: ${DASHBOARD_PATH}${NC}"
echo -e "${BLUE}Combined Report: ${REPORT_PATH}${NC}"

# Make script executable
chmod +x "$0" 