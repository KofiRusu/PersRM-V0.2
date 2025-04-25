# PersLM Plugin Enhancer

The Plugin Enhancer is a comprehensive system for analyzing, optimizing, and improving UI plugins in the PersLM system. It provides tools for performance monitoring, automatic enhancement, and model comparison to continuously improve plugin quality.

## Features

- **Performance Analysis**: Track and measure lifecycle methods' performance (init, destroy, render)
- **Automatic Enhancement**: Apply performance optimizations automatically
- **Model Comparison**: Compare plugin performance across different model implementations
- **Training Pipeline**: Run autonomous training to find optimal enhancements
- **Visual Dashboards**: View performance metrics and improvements over time

## Architecture

The Plugin Enhancer system consists of the following components:

1. **Core Enhancer Engine**: Analyzes and enhances UI plugins
2. **Training Pipeline**: Runs autonomous model comparison and learning extraction
3. **Database Integration**: Stores analysis reports, model comparisons, and learnings
4. **Dashboard UI**: Visualizes performance metrics and improvement trends
5. **CLI Tools**: Command-line interface for running analyses and training

## Getting Started

### Prerequisites

- Node.js >= 16.0.0
- PostgreSQL database
- PersLM UI plugin system

### Installation

The Plugin Enhancer is included in the PersLM system. Make sure your environment variables are set up correctly:

```bash
# .env file
DATABASE_URL="postgresql://username:password@localhost:5432/perslm"
```

Run the Prisma migrations to set up the database schema:

```bash
npm run prisma:migrate:dev
```

### Usage

#### Analyzing Plugins

To analyze plugins and generate a report:

```bash
npm run enhance-plugins:analyze
```

This will:
1. Scan all registered UI plugins
2. Analyze their performance metrics
3. Generate enhancement suggestions
4. Save the report to the database

#### Enhancing Plugins

To apply automatic enhancements to plugins:

```bash
npm run enhance-plugins
```

This will:
1. Load the latest analysis report
2. Apply performance enhancements to plugins
3. Add instrumentation for monitoring

#### Training Models

To run autonomous training:

```bash
npm run enhance-plugins:train
```

This will:
1. Run multiple iterations of analysis with different models
2. Compare performance metrics across models
3. Extract learnings from the comparisons
4. Store training results in the database

#### Viewing Results

To view training results in the console:

```bash
npm run enhance-plugins:view-training
```

Or access the dashboard UI at:

```
http://localhost:3000/dashboard/plugins/enhancer
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `enhance-plugins` | Run the default analysis and enhancement pipeline |
| `enhance-plugins:analyze` | Analyze plugins without applying enhancements |
| `enhance-plugins:train` | Run autonomous training against different models |
| `enhance-plugins:compare` | Compare plugin performance against a specific model |
| `enhance-plugins:view-training` | View training results in the console |

All commands support the `--database` flag to enable database logging.

## Database Schema

The Plugin Enhancer uses the following database tables:

- `plugin_enhancer_reports`: Overall analysis reports
- `global_suggestions`: System-wide enhancement suggestions
- `plugin_analyses`: Per-plugin analysis results
- `plugin_suggestions`: Per-plugin enhancement suggestions
- `model_comparisons`: Performance comparison between models
- `training_sessions`: Autonomous training sessions
- `training_learnings`: Learnings extracted from training

## API Reference

The Plugin Enhancer exports the following key components:

- `PluginEnhancer`: Main class for analysis and enhancement
- `SeverityLevel`: Enum for suggestion severity
- `SuggestionType`: Enum for suggestion types
- `ModelType`: Enum for model types

## Dashboards

The Plugin Enhancer provides the following dashboards:

- **Overview**: Summary of plugin status and issues
- **Performance**: Visualization of plugin performance metrics
- **Suggestions**: List of enhancement suggestions
- **Model Comparison**: Performance comparison between models
- **Training Data**: Results from autonomous training

## Contributing

We welcome contributions to the Plugin Enhancer system. Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Add your changes
4. Run tests with `npm test`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 