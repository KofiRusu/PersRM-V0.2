#!/bin/bash

# Enhanced benchmark runner for PersLM
# This script runs the benchmark, scoring, and visualization processes

set -e # Exit on any error

# Default values
PROMPT_DIR="./generation-benchmark/prompts"
OUTPUT_DIR="./generation-benchmark/results"
ANALYSIS_DIR="./generation-benchmark/analysis"
REPORT_DIR="$ANALYSIS_DIR/reports"
SUMMARY_DIR="$ANALYSIS_DIR/summaries"
LOG_DIR="./generation-benchmark/logs"
LOG_FILE="$LOG_DIR/benchmark-$(date +%Y%m%d_%H%M%S).log"
VERBOSE=false
VISUALIZE=true
RETRIES=3
BASELINE=true
ENHANCED=true
SELF_IMPROVE=false
ERROR_COUNT=0
MAX_ERRORS=3

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to check command status and log errors
check_status() {
  if [ $1 -ne 0 ]; then
    echo "❌ ERROR: $2 failed with exit code $1" | tee -a "$LOG_FILE"
    # Increment error count
    ERROR_COUNT=$((ERROR_COUNT + 1))
    
    # Check if we've reached max errors
    if [ $ERROR_COUNT -ge $MAX_ERRORS ]; then
      echo "❌ ERROR: Maximum number of errors ($MAX_ERRORS) reached. Exiting." | tee -a "$LOG_FILE"
      exit 1
    fi
    
    # Continue with warnings instead of exiting immediately
    echo "⚠️ WARNING: Continuing despite error. Error $ERROR_COUNT of $MAX_ERRORS allowed." | tee -a "$LOG_FILE"
    return 1
  fi
  return 0
}

# Function to cleanup on exit
cleanup() {
  # Save exit status
  exit_status=$?
  
  # Log completion
  if [ $exit_status -eq 0 ]; then
    echo "✅ Benchmark process completed successfully!" | tee -a "$LOG_FILE"
  else
    echo "❌ Benchmark process exited with errors (code: $exit_status)" | tee -a "$LOG_FILE"
  fi
  
  # Calculate time taken
  if [ -n "$START_TIME" ]; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    MINUTES=$((DURATION / 60))
    SECONDS=$((DURATION % 60))
    echo "Time taken: $MINUTES minutes and $SECONDS seconds" | tee -a "$LOG_FILE"
  fi
  
  echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
}

# Register cleanup function
trap cleanup EXIT

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -p|--prompts) PROMPT_DIR="$2"; shift ;;
        -o|--output) OUTPUT_DIR="$2"; shift ;;
        -a|--analysis) ANALYSIS_DIR="$2"; shift ;;
        -v|--verbose) VERBOSE=true ;;
        --no-visualize) VISUALIZE=false ;;
        --no-baseline) BASELINE=false ;;
        --no-enhanced) ENHANCED=false ;;
        --self-improve) SELF_IMPROVE=true ;;
        -r|--retries) RETRIES="$2"; shift ;;
        --max-errors) MAX_ERRORS="$2"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Update dependent directories if analysis dir changed
REPORT_DIR="$ANALYSIS_DIR/reports"
SUMMARY_DIR="$ANALYSIS_DIR/summaries"

# Ensure output directories exist
mkdir -p "$OUTPUT_DIR"
mkdir -p "$ANALYSIS_DIR"
mkdir -p "$REPORT_DIR"
mkdir -p "$SUMMARY_DIR"

echo "🚀 Starting PersLM benchmark process..." | tee -a "$LOG_FILE"
echo "Prompt directory: $PROMPT_DIR" | tee -a "$LOG_FILE"
echo "Output directory: $OUTPUT_DIR" | tee -a "$LOG_FILE"
echo "Analysis directory: $ANALYSIS_DIR" | tee -a "$LOG_FILE"
echo "Start time: $(date)" | tee -a "$LOG_FILE"
START_TIME=$(date +%s)

# Check if prompt directory exists and has prompts
if [ ! -d "$PROMPT_DIR" ]; then
  echo "❌ ERROR: Prompt directory not found: $PROMPT_DIR" | tee -a "$LOG_FILE"
  exit 1
fi

# Count total prompts to process
TOTAL_PROMPTS=$(find "$PROMPT_DIR" -name "prompt-*.txt" | wc -l)
if [ $TOTAL_PROMPTS -eq 0 ]; then
  echo "❌ ERROR: No prompt files found in $PROMPT_DIR" | tee -a "$LOG_FILE"
  exit 1
fi

echo "Found $TOTAL_PROMPTS prompt files to process" | tee -a "$LOG_FILE"

# Step 1a: Generate baseline components if enabled
if [ "$BASELINE" = true ]; then
    echo "📝 Generating baseline components..." | tee -a "$LOG_FILE"
    BASELINE_ARGS="--promptDir $PROMPT_DIR --outputDir $OUTPUT_DIR/baseline --type baseline --retries $RETRIES"
    if [ "$VERBOSE" = true ]; then
        BASELINE_ARGS="$BASELINE_ARGS --verbose"
    fi

    node src/cli/benchmark.js $BASELINE_ARGS 2>&1 | tee -a "$LOG_FILE"
    if ! check_status $? "Baseline component generation"; then
        echo "⚠️ WARNING: Baseline component generation had errors, some components may be missing" | tee -a "$LOG_FILE"
    fi
    
    # Count generated baseline components
    BASELINE_GENERATED=$(find "$OUTPUT_DIR/baseline" -name "*.jsx" -o -name "*.tsx" | wc -l | tr -d ' ')
    echo "✅ Generated $BASELINE_GENERATED baseline components" | tee -a "$LOG_FILE"
    
    # Check if all components were generated
    if [ $BASELINE_GENERATED -lt $TOTAL_PROMPTS ]; then
        echo "⚠️ WARNING: Not all baseline components were generated. Expected $TOTAL_PROMPTS, got $BASELINE_GENERATED." | tee -a "$LOG_FILE"
    fi
fi

# Step 1b: Generate enhanced components if enabled
if [ "$ENHANCED" = true ]; then
    echo "📝 Generating enhanced components..." | tee -a "$LOG_FILE"
    ENHANCED_ARGS="--promptDir $PROMPT_DIR --outputDir $OUTPUT_DIR/enhanced --type enhanced --retries $RETRIES"
    if [ "$VERBOSE" = true ]; then
        ENHANCED_ARGS="$ENHANCED_ARGS --verbose"
    fi
    
    if [ "$SELF_IMPROVE" = true ]; then
        ENHANCED_ARGS="$ENHANCED_ARGS --selfImprove"
        echo "🧠 Self-improvement mode enabled" | tee -a "$LOG_FILE"
    fi

    node src/cli/benchmark.js $ENHANCED_ARGS 2>&1 | tee -a "$LOG_FILE"
    if ! check_status $? "Enhanced component generation"; then
        echo "⚠️ WARNING: Enhanced component generation had errors, some components may be missing" | tee -a "$LOG_FILE"
    fi
    
    # Count generated enhanced components
    ENHANCED_GENERATED=$(find "$OUTPUT_DIR/enhanced" -name "*.jsx" -o -name "*.tsx" | wc -l | tr -d ' ')
    echo "✅ Generated $ENHANCED_GENERATED enhanced components" | tee -a "$LOG_FILE"
    
    # Check if all components were generated
    if [ $ENHANCED_GENERATED -lt $TOTAL_PROMPTS ]; then
        echo "⚠️ WARNING: Not all enhanced components were generated. Expected $TOTAL_PROMPTS, got $ENHANCED_GENERATED." | tee -a "$LOG_FILE"
    fi
fi

# Step 2: Score the generated components
echo "🔍 Scoring generated components..." | tee -a "$LOG_FILE"
SUMMARY_FILE="$SUMMARY_DIR/benchmark-summary-$(date +%Y%m%d_%H%M%S).md"

SCORE_ARGS="--reports $REPORT_DIR --summary $SUMMARY_FILE"
if [ "$BASELINE" = true ]; then
    SCORE_ARGS="$SCORE_ARGS --baseline $OUTPUT_DIR/baseline"
fi
if [ "$ENHANCED" = true ]; then
    SCORE_ARGS="$SCORE_ARGS --enhanced $OUTPUT_DIR/enhanced"
fi
if [ "$VERBOSE" = true ]; then
    SCORE_ARGS="$SCORE_ARGS --verbose"
fi

node src/cli/score.js $SCORE_ARGS 2>&1 | tee -a "$LOG_FILE"
if ! check_status $? "Component scoring"; then
    echo "⚠️ WARNING: Component scoring had errors, results may be incomplete" | tee -a "$LOG_FILE"
else
    echo "✅ Component scoring completed successfully" | tee -a "$LOG_FILE"
    echo "Score summary generated at: $SUMMARY_FILE" | tee -a "$LOG_FILE"
fi

# Step 3: Visualize results if enabled
if [ "$VISUALIZE" = true ]; then
    echo "📊 Generating visualizations and analysis..." | tee -a "$LOG_FILE"
    VISUALIZATION_FILE="$ANALYSIS_DIR/benchmark-report-$(date +%Y%m%d_%H%M%S).html"
    
    VISUALIZE_ARGS="--input $OUTPUT_DIR --output $ANALYSIS_DIR --summary $SUMMARY_FILE --reports $REPORT_DIR"
    if [ "$VERBOSE" = true ]; then
        VISUALIZE_ARGS="$VISUALIZE_ARGS --verbose"
    fi
    
    node src/cli/visualize-benchmarks.js $VISUALIZE_ARGS 2>&1 | tee -a "$LOG_FILE"
    if ! check_status $? "Visualization generation"; then
        echo "⚠️ WARNING: Visualization generation had errors, results may be incomplete" | tee -a "$LOG_FILE"
    else
        echo "✅ Visualization completed successfully" | tee -a "$LOG_FILE"
        echo "Visualization generated at: $VISUALIZATION_FILE" | tee -a "$LOG_FILE"
        
        # Open the report if on macOS
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open "$VISUALIZATION_FILE" 2>/dev/null || true
        fi
    fi
fi

# Step 4: Run self-improvement analysis if enabled
if [ "$SELF_IMPROVE" = true ]; then
    echo "🧠 Running self-improvement analysis..." | tee -a "$LOG_FILE"
    
    IMPROVE_ARGS="--input $REPORT_DIR"
    if [ "$VERBOSE" = true ]; then
        IMPROVE_ARGS="$IMPROVE_ARGS --verbose"
    fi
    
    node src/cli/improve.js $IMPROVE_ARGS 2>&1 | tee -a "$LOG_FILE"
    if ! check_status $? "Self-improvement analysis"; then
        echo "⚠️ WARNING: Self-improvement analysis had errors" | tee -a "$LOG_FILE"
    else
        echo "✅ Self-improvement analysis completed successfully" | tee -a "$LOG_FILE"
        echo "Improvement suggestions saved to: $ANALYSIS_DIR/improvement-suggestions.md" | tee -a "$LOG_FILE"
    fi
fi

# No need for end calculation as it's done in the cleanup function

# Final status message based on error count
if [ $ERROR_COUNT -eq 0 ]; then
    echo "🎉 Benchmark process completed successfully with no errors!" | tee -a "$LOG_FILE"
else
    echo "🎉 Benchmark process completed with $ERROR_COUNT warnings/errors" | tee -a "$LOG_FILE"
fi

echo "Results available in: $OUTPUT_DIR" | tee -a "$LOG_FILE"
echo "Analysis available in: $ANALYSIS_DIR" | tee -a "$LOG_FILE"
