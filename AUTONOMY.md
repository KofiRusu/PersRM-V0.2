# Autonomy and Self-Improvement Guide

This guide explains PersLM's autonomy capabilities, which allow it to run independently and continuously improve without human prompting.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Configuration](#configuration)
- [Autonomy Loop](#autonomy-loop)
- [Task Management](#task-management)
- [Scheduling](#scheduling)
- [Safety Controls](#safety-controls)
- [Feedback System](#feedback-system)
- [Example Workflows](#example-workflows)
- [Troubleshooting](#troubleshooting)

## Overview

The Autonomy module enables PersLM to operate independently by:

- **Executing Recurring Tasks**: Run scheduled tasks without human prompting
- **Self-Monitoring**: Collect metrics and feedback on its own performance
- **Continuous Improvement**: Learn from past interactions and feedback
- **Safe Operation**: Apply safety checks and approval workflows
- **Structured Workflows**: Execute complex, multi-step task flows

This creates a system that becomes more valuable over time through autonomous learning and adaptation.

## Installation

The autonomy capabilities are part of the core PersLM system. After installing the base system, ensure you have the following additional dependencies:

```bash
pip install pyyaml schedule apscheduler
```

## Configuration

Configuration is managed through a YAML file located at `src/loop/config/config.yaml`. You can override this path with the `--config` command-line argument.

### Example Configuration

```yaml
# Autonomy level configuration
autonomy:
  # Level options: disabled, assisted, supervised, full
  default_level: supervised
  
  # Task execution settings
  max_concurrent_tasks: 5
  
  # Approval configuration
  require_approval:
    new_tasks: true
    modified_tasks: true
    high_risk: true
  
  # Safety configuration
  safety:
    enable_safety_checks: true
    max_runtime_per_task: 300  # seconds
    max_chain_depth: 10
    restricted_actions: []

# Scheduler configuration
scheduler:
  enable: true
  check_interval: 1.0  # seconds
  
  # Default recurring tasks
  recurring_tasks:
    - name: Daily Review
      description: Review system performance and user interactions
      schedule_type: daily
      time_of_day: "03:00"  # Run at 3 AM
      action: daily_review
      parameters:
        max_items: 100
      enabled: true
```

## Autonomy Loop

The autonomy loop is the core mechanism that enables PersLM to operate independently.

### Starting the Loop

```bash
# Start autonomy loop with default settings
python -m src.loop.autonomy_loop

# With specific configuration and autonomy level
python -m src.loop.autonomy_loop --config custom_config.yaml --autonomy supervised

# With detailed logging
python -m src.loop.autonomy_loop --log-level debug
```

### Autonomy Levels

The system supports four autonomy levels with increasing independence:

1. **Disabled**: No autonomous actions allowed. System only responds to direct commands.
2. **Assisted**: Suggests actions but requires explicit approval before execution.
3. **Supervised**: Executes routine actions independently but requires approval for new, modified, or high-risk tasks.
4. **Full**: Complete autonomy with minimal oversight, executing all tasks independently.

### Loop Logic

The autonomy loop follows this general flow:

1. **Initialization**:
   - Load configuration
   - Initialize components (scheduler, feedback system)
   - Register available actions
   - Load recurring tasks

2. **Continuous Operation**:
   - Schedule monitors time and triggers scheduled tasks
   - Tasks are executed according to dependencies and priorities
   - Results and feedback are collected and stored
   - System learns from feedback to improve future execution

3. **Monitoring**:
   - Performance metrics are tracked
   - Errors and issues are logged
   - Periodic reports are generated

## Task Management

Tasks are the fundamental unit of work in the autonomy system.

### Task Structure

Each task contains:

- **Identifier**: Unique ID for tracking
- **Action**: The specific function to execute
- **Parameters**: Input data for the action
- **Dependencies**: Other tasks that must complete first
- **Metadata**: Additional task-specific information
- **Status**: Current state (pending, running, completed, failed)

### Task Flow

Tasks move through the following lifecycle:

1. **Creation**: Tasks are created by the scheduler or other tasks
2. **Approval**: Tasks are approved based on autonomy level
3. **Execution**: Tasks are executed when dependencies are met
4. **Completion**: Results are collected and feedback is generated
5. **Learning**: System improves based on task outcomes

### Task Dependencies

Complex workflows are created by defining dependencies between tasks:

```python
# Example of creating a task chain
manager.create_chain([
    {
        "action": "fetch_data",
        "name": "Fetch Latest News"
    },
    {
        "action": "analyze_data",
        "name": "Analyze News Content",
        "dependencies": ["Fetch Latest News"]
    },
    {
        "action": "generate_report",
        "name": "Generate News Summary",
        "dependencies": ["Analyze News Content"]
    }
])
```

## Scheduling

The scheduling system triggers tasks at specified times or intervals.

### Schedule Types

- **Once**: Run task once at a specific time
- **Interval**: Run repeatedly at a fixed interval (e.g., every 12 hours)
- **Daily**: Run once a day at a specific time
- **Weekly**: Run on specific days of the week
- **Monthly**: Run on specific days of the month
- **Cron**: Run according to cron expression

### Example Schedules

```yaml
# Daily at specific time
- name: Daily Review
  schedule_type: daily
  time_of_day: "03:00"
  action: daily_review

# Interval-based
- name: Memory Consolidation
  schedule_type: interval
  interval: 43200  # 12 hours
  action: memory_consolidation

# Weekly
- name: Weekly Report
  schedule_type: weekly
  days: [0]  # Monday
  time_of_day: "09:00"
  action: generate_weekly_report
```

## Safety Controls

The autonomy system includes several safety mechanisms to prevent issues.

### Approval Workflow

Based on the autonomy level, tasks may require approval before execution:

1. New tasks may require approval to prevent unexpected behavior
2. Modified tasks may require approval to catch changes in behavior
3. High-risk tasks always require approval in supervised mode

### Task Limits

- Maximum concurrent tasks prevents resource exhaustion
- Maximum execution time prevents runaway processes
- Maximum chain depth prevents infinite recursion

### Restricted Actions

Certain high-risk actions can be restricted:
- System-level commands
- External API calls
- Data deletion operations

### Monitoring and Rollback

The system continuously monitors task execution and can detect issues:
- Performance degradation
- Error patterns
- Unusual behavior

## Feedback System

The feedback system collects and processes information about system performance.

### Feedback Categories

- **Response Quality**: Evaluates the quality of model outputs
- **Reasoning Quality**: Assesses the logic and correctness of reasoning chains
- **Hallucination**: Detects and measures factual inaccuracies
- **Tool Usage**: Monitors appropriate use of tools and success rates
- **Task Completion**: Tracks task success and failure rates
- **Performance**: Measures response times and resource usage

### Feedback Collection

Feedback is collected automatically through the `FeedbackLogger`:

```python
# Example of logging response quality
feedback_logger.log_response_quality(
    response="The capital of France is Paris.",
    query="What is the capital of France?",
    score=0.95,
    is_high_quality=True
)

# Example of logging hallucination detection
feedback_logger.log_hallucination(
    response="The Python programming language was created in 1995.",
    query="When was Python created?",
    hallucination_detected=True,
    severity=FeedbackSeverity.MEDIUM,
    hallucinated_span="1995"  # Actually created in 1991
)
```

### Learning from Feedback

The system uses collected feedback to improve over time:
1. Identifying patterns in successful vs. unsuccessful executions
2. Adjusting parameters based on performance metrics
3. Prioritizing more successful approaches
4. Avoiding repeated failures

## Example Workflows

The autonomy system comes with several pre-configured task workflows:

### Daily Review

```yaml
daily_review:
  description: Review system performance and user interactions
  action: daily_review
  parameters:
    timeframe: "1 day"
    include_metrics: true
    include_feedback: true
    generate_report: true
```

This task:
1. Collects metrics from the last 24 hours
2. Analyzes user feedback and interactions
3. Generates a markdown report
4. Stores findings in memory for future reference

### News Update

```yaml
summarize_news:
  description: Fetch and summarize news articles
  action: news_update
  parameters:
    categories: ["technology", "science", "world"]
    max_articles: 10
```

This task:
1. Retrieves recent news articles from configured sources
2. Summarizes key information
3. Categorizes and prioritizes updates
4. Stores summaries for future reference

### Error Debugging

```yaml
debug_errors:
  description: Analyze and attempt to resolve recent errors
  action: debug_errors
  parameters:
    max_errors: 10
    auto_fix: false
```

This task:
1. Analyzes recent error logs
2. Identifies patterns and common issues
3. Suggests or implements fixes for known issues
4. Reports on error trends and resolutions

## Troubleshooting

### Common Issues

1. **Tasks Not Running**
   - Check autonomy level (must be supervised or full)
   - Verify task dependencies are met
   - Check for approval requirements

2. **Schedule Issues**
   - Verify system time is correct
   - Check time format in schedule (HH:MM)
   - Ensure scheduler service is running

3. **Autonomy Loop Stopped**
   - Check for exceptions in logs
   - Verify system resources are sufficient
   - Restart the autonomy loop

For more detailed diagnostics, run the autonomy loop with debug logging:

```bash
python -m src.loop.autonomy_loop --log-level debug
```

### Resetting the System

If you need to reset the autonomy system to a clean state:

```bash
# Stop the loop
python -m src.loop.autonomy_loop --stop

# Remove stored data
rm -rf data/autonomy/*
rm -rf data/scheduler/*
rm -rf data/feedback/*

# Restart with clean state
python -m src.loop.autonomy_loop
```
