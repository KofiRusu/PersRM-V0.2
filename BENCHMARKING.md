# PersLM Model Benchmarking Guide

This document provides instructions on how to perform performance benchmarking for different language models used in the PersLM system.

## Available Benchmarking Tools

PersLM includes several benchmarking tools:

1. **Model Comparison Tool** (`scripts/compare-models.js`): Compares performance across different models (OpenAI vs DeepSeek vs local models)
2. **API Benchmarking Tool** (`scripts/benchmark.js`): Tests API performance and response times
3. **Generation Benchmark** (`run-benchmark.sh`): Tests component generation quality and performance

## Quick Start: Model Comparison

To compare performance between different models (e.g., OpenAI GPT-4o, GPT-3.5 Turbo, and DeepSeek):

```bash
node scripts/compare-models.js
```

This will:
- Run predefined test prompts against multiple model configurations
- Generate demo components from each model
- Measure and compare performance metrics (response time, code size)
- Save results to the `benchmark-results` directory

## Using Generation Benchmarks

For more detailed component generation benchmarks:

```bash
./run-benchmark.sh --verbose
```

Options:
- `--no-baseline`: Skip baseline model testing
- `--no-enhanced`: Skip enhanced model testing
- `--self-improve`: Enable self-improvement mode
- `--verbose`: Show detailed output
- `--retries <n>`: Number of retries for failed generations

## API Benchmarking

To benchmark API performance:

```bash
node scripts/benchmark.js
```

Or for more advanced API testing with specific endpoints:

```bash
node scripts/run-benchmarks.js --server
```

## Custom Model Configuration

To test with your own API keys:

1. Ensure API keys are set in your `.env` file:
   ```
   OPENAI_API_KEY=your_openai_key
   DEEPSEEK_API_KEY=your_deepseek_key
   ```

2. Edit the `MODELS` array in `scripts/compare-models.js` to add or modify model configurations

## Understanding Benchmark Results

Benchmark results include:

- **Response Time**: How quickly the model generates responses
- **Code Size**: The size of the generated code
- **Success Rate**: Percentage of successful completions
- **Best/Worst Models**: Which models performed best/worst for each prompt

Results are saved to the `benchmark-results` directory for further analysis.

## Creating Custom Benchmarks

To create custom benchmarks:

1. Add your test prompts to the `TEST_PROMPTS` array in the benchmark script
2. Add any new models to the `MODELS` array
3. Run the benchmark with your custom configurations

## Troubleshooting

- If you encounter module import errors, run `npm install` to install dependencies
- If API keys aren't working, verify they're correctly set in the `.env` file
- For local model testing, ensure Ollama is running and accessible 