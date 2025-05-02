# Strategy Discovery System for PersLM

This document explains how to use the automatic strategy discovery feature in PersLM's self-improvement system.

## Overview

The Strategy Discovery System autonomously discovers new adaptation strategies when existing ones reach a plateau. This allows the PersLM agent to continuously evolve its capabilities and overcome limitations in its current set of improvement strategies.

## Key Components

The system consists of three main components:

1. **SelfImprovementMemory**: Records and analyzes the outcomes of applied strategies
2. **SelfTrainer**: Orchestrates the improvement process using known strategies
3. **StrategyDiscoveryEngine**: Analyzes patterns, identifies plateaus, and generates new strategies

## How Strategy Discovery Works

1. The system tracks the outcomes of each applied strategy
2. When existing strategies repeatedly fail to produce significant improvements (plateau), the system triggers discovery
3. The StrategyDiscoveryEngine analyzes patterns in successful and failing strategies
4. Using this analysis, it generates a new strategy tailored to address the specific limitations
5. The new strategy is validated, added to the available strategies, and applied
6. The outcome is recorded for future learning

## Using Strategy Discovery in the CLI

The strategy discovery feature can be enabled via the `score` command:

```bash
persrm score --self-improve --discover [other options]
```

### Command Line Options

- `--self-improve`: Enables the self-improvement system
- `--discover`: Activates the strategy discovery feature
- `--max-iterations <number>`: Sets the maximum number of improvement iterations (default: 5)
- `--improvement-threshold <number>`: Sets the minimum improvement percentage to continue (default: 5)

### Example Usage

```bash
# Basic usage with default settings
persrm score --input ./components --output ./reports --self-improve --discover

# Advanced usage with custom settings
persrm score --input ./components --output ./reports --self-improve --discover --max-iterations 10 --improvement-threshold 3 --verbose
```

## Understanding the Reports

When strategy discovery is enabled, the system generates additional reports:

1. **self-improvement-memory.md**: Visualizes the memory of all applied strategies and their outcomes
2. **strategy-discovery-report.md**: Documents discovered strategies and their performance
3. **self-improvement-summary.md**: Summarizes overall improvement and strategy effectiveness

## Example Discovery Report

```markdown
# Strategy Discovery Report

Generated: 2023-07-15 10:30:00

## Overview
- Total strategies discovered: 3
- Average improvement from discovered strategies: 12.5%
- Discovery triggered after 5 plateaus

## Discovered Strategies

### AccessibilityEnhancementStrategy
- Created: 2023-07-15 10:15:00
- Target component types: form, button
- Target requirements: accessibility
- Target score range: 14-16
- Average improvement: 18.2%
- Success rate: 85%

### RefinedResponsivenessStrategy
- Created: 2023-07-15 10:20:00
- Target component types: card, modal
- Target requirements: responsiveness
- Target score range: 18-20
- Average improvement: 9.7%
- Success rate: 75%

### PerformanceOptimizationStrategy
- Created: 2023-07-15 10:25:00
- Target component types: table, data-display
- Target requirements: performance
- Target score range: 16-18
- Average improvement: 10.1%
- Success rate: 80%
```

## Advanced Configuration

For advanced users, the StrategyDiscoveryEngine can be customized by modifying:

- `plateauThreshold`: Number of attempts with minimal improvement before considering a plateau
- `minImprovementThreshold`: Minimum percentage improvement considered significant
- `storePath`: Path to store discovered strategies

These can be configured programmatically when initializing the SelfTrainer in custom scripts.

## Best Practices

1. Start with `--self-improve` only, then add `--discover` once you have baseline performance data
2. Use `--verbose` to monitor the discovery process
3. Review the strategy discovery report to understand which strategies work best for your components
4. Gradually increase `--max-iterations` to allow more time for discovery and refinement

## Limitations

- Strategy discovery works best with a robust history of strategy applications
- Initial discoveries may be less effective than later ones as the system learns
- Very specialized components might require manual strategy creation

## Next Steps

The Strategy Discovery System is continuously evolving. Future enhancements will include:

- Meta-learning capabilities to improve the discovery mechanism itself
- Cross-component strategy generalization
- Hierarchical strategy composition
- Integration with external knowledge bases 