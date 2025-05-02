# PersLM Self-Improvement Engine

## Overview

The Self-Improvement Engine is an autonomous module that analyzes component generation results, identifies weaknesses, and suggests improvements to both prompts and enhancement strategies. This system enables PersLM to continuously refine its generation capabilities through an automated feedback loop.

## Features

- **Scoring Report Analysis**: Processes scoring reports generated during benchmarking to extract insights about component quality
- **Weakness Identification**: Pinpoints specific categories where components consistently underperform
- **Prompt Enhancement**: Suggests specific improvements to component prompts based on identified weaknesses
- **Strategy Refinement**: Recommends changes to enhancement strategies to strengthen areas with minimal improvement
- **Self-Learning**: Creates a feedback loop to continuously improve generation quality
- **Strategy Discovery**: Automatically develops new enhancement strategies based on observed patterns and plateaus
- **Multi-Cycle Training**: Supports multiple training cycles with adaptive strategy selection

## Architecture

The Self-Improvement Engine consists of:

1. **SelfImprovementEngine Class**: Core implementation with analysis and suggestion capabilities
2. **SelfTrainer Class**: Manages the self-improvement cycle and applies strategies
3. **PromptRefiner Class**: Specialized module for refining component generation prompts
4. **StrategyDiscoveryEngine**: Discovers new strategies based on past performance 
5. **SelfImprovementMemory**: Stores and retrieves performance data to guide improvement
6. **CLI Integration**: Command-line interface for running analysis and viewing suggestions
7. **Report Generation**: Markdown output with detailed findings and recommendations

## Usage

### Running the Benchmark with Self-Improvement

The complete benchmark process with self-improvement can be run using:

```bash
./run-benchmark.sh --self-improve
```

Options:
- `--prompts <path>`: Directory containing prompt files
- `--output <path>`: Directory for saving generated components
- `--analysis <path>`: Directory for saving analysis results
- `--verbose`: Show detailed output
- `--no-visualize`: Skip visualization generation
- `--self-improve`: Enable self-improvement analysis
- `--retries <number>`: Number of retries for failed generations
- `--max-errors <number>`: Maximum number of errors before stopping

### Analyzing Scoring Reports

Run the `improve` command to analyze scoring reports and generate suggestions:

```bash
node src/cli/improve.js --input ./generation-benchmark/analysis/reports
```

Options:
- `--input <path>`: Path to scoring reports directory (default: `./generation-benchmark/analysis/reports`)
- `--output <path>`: Path to output suggestions file (default: `./generation-benchmark/analysis/improvement-suggestions.md`)
- `--verbose`: Show detailed analysis information during processing
- `--apply`: Automatically apply improvement suggestions (experimental)
- `--memory <path>`: Path to memory storage file (default: `./improvement-memory.json`)

### Running Multi-Cycle Training

For multi-cycle training with progressive improvement:

```bash
npx ts-node src/cli/persrm-cli.ts train-multi-cycle --prompts ./generation-benchmark/prompts --max-cycles 5
```

Options:
- `--prompts <path>`: Directory containing prompt files
- `--max-cycles <number>`: Maximum number of training cycles (default: 3)
- `--threshold <number>`: Improvement threshold percentage (default: 5)
- `--verbose`: Show detailed output during training
- `--discovery`: Enable strategy discovery (default: true)

### Exploring Strategy Outcomes

To visualize strategy performance and outcomes:

```bash
npx ts-node src/cli/persrm-cli.ts visualize-memory
```

### Testing the Self-Improvement System

A test script is provided to verify system functionality:

```bash
npx ts-node src/self-improvement/test-self-improvement.ts
```

## Self-Improvement Components

### 1. SelfImprovementEngine

The core engine that analyzes scoring reports and generates improvement suggestions.

Key methods:
- `analyzeScoringReports(reportDir)`: Analyzes scoring reports in the specified directory
- `suggestPromptImprovements(summary)`: Suggests improvements to component prompts
- `suggestEnhancementStrategies(summary)`: Suggests strategies for enhancing components

### 2. SelfTrainer

Manages the self-improvement cycle, applies strategies, and records outcomes.

Key methods:
- `improveComponent(prompt, initialScore)`: Applies improvement strategies to a component
- `applyStrategy(strategyName, input)`: Applies a specific strategy to an input
- `getRecommendedStrategies(currentScore)`: Gets strategies recommended for the current score

### 3. PromptRefiner

Specialized module for refining component generation prompts.

Key methods:
- `refineWithExamples(prompt)`: Adds concrete examples to guide implementation
- `enhanceWithAccessibility(prompt)`: Adds accessibility requirements
- `enhanceWithUX(prompt)`: Adds UX best practices
- `enhanceCreativity(prompt)`: Encourages more creative solutions

### 4. StrategyDiscoveryEngine

Discovers new strategies based on past performance and identified plateaus.

Key methods:
- `discoverStrategy(context, plateauedStrategies, currentScore)`: Discovers a new strategy
- `registerDiscoveredStrategy(strategy)`: Registers a newly discovered strategy
- `generateDiscoveryReport()`: Generates a report of discovered strategies

### 5. SelfImprovementMemory

Stores and retrieves performance data to guide improvement.

Key methods:
- `recordStrategyOutcome(outcome)`: Records the outcome of applying a strategy
- `getStrategyRecommendations(currentScore)`: Gets strategies recommended for the current score
- `visualizeMemory()`: Generates a visualization of strategy performance

## Generated Suggestions

The engine produces two types of suggestions:

1. **Prompt Improvements**: Recommendations for enhancing the component generation prompts to address weaknesses
2. **Enhancement Strategies**: Suggested changes to the enhancement phase implementation to better improve specific aspects

### Example Output

```markdown
# PersLM Self-Improvement Suggestions

**Generated**: 2023-09-15

## Analysis Summary

- **Reports Analyzed**: 12
- **Component Types**: button, form, card, table
- **Most Common Weakness**: accessibility

### Average Scores

| Category | Score |
|----------|-------|
| fidelity | 4.25/5 |
| codeQuality | 3.92/5 |
| accessibility | 2.58/5 |
| uxPolish | 3.17/5 |
| innovation | 3.42/5 |

### Key Weaknesses

- **accessibility**: 8 occurrences
- **uxPolish**: 5 occurrences

## Prompt Improvement Suggestions

- Explicitly require ARIA attributes for interactive elements
- Request keyboard navigation support for all interactive components
- Specify responsive design requirements with concrete breakpoints
- Request smooth transitions for state changes
...

## Enhancement Strategy Suggestions

- Integrate automated accessibility checks in the enhancement process
- Add a comprehensive ARIA attribute application step
- Implement keyboard navigation and focus management improvements
- Apply a consistent responsive design pattern library
...

## Next Steps

1. Apply the suggested prompt improvements to the component generation prompts
2. Implement the suggested enhancement strategies in the component enhancement process
3. Run the benchmark again to measure the impact of these improvements
4. Continue the self-improvement cycle to refine results further
```

## Implementation Details

### Analysis Metrics

The engine analyzes components across multiple dimensions:

- **Fidelity**: How well the component matches requirements
- **Code Quality**: Structure, patterns, error handling
- **Accessibility**: ARIA, keyboard, screen reader support
- **UX Polish**: Transitions, responsiveness, states
- **Innovation**: Additional helpful features

### Available Adaptation Strategies

The system includes various strategies for improving component generation:

#### Prompt-based Strategies:
- **AddExamples**: Add concrete examples to guide implementation
- **AddAccessibility**: Enhance with accessibility requirements
- **AddUXGuidelines**: Add UX best practices and guidelines
- **IncreaseCreativity**: Encourage more creative solutions
- **AddPerformance**: Add performance optimization requirements
- **ImproveStructure**: Improve prompt structure and clarity

#### Context-based Strategies:
- **AddDesignSystem**: Incorporate design system references
- **AddComponentPatterns**: Include common component patterns
- **EnhanceTypeDefinitions**: Add more detailed type definitions

#### Discovery-based Strategies:
- New strategies are automatically discovered based on observed patterns

## Integration with PersLM

The Self-Improvement Engine completes the feedback loop in the PersLM system:

1. **Generation**: Components are generated from prompts
2. **Enhancement**: Components are enhanced with UX improvements
3. **Evaluation**: Components are scored against standardized criteria
4. **Analysis**: Scores are analyzed to identify weaknesses
5. **Improvement**: Suggestions are applied to improve future generations
6. **Memory**: Outcomes are stored to guide future improvements

This continuous improvement cycle allows PersLM to autonomously refine its capabilities over time, resulting in progressively higher quality component generation. 