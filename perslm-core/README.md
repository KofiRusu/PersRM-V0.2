# PersLM Core (perslm-core)

This module contains the base reasoning model infrastructure for PersLM, including:

- Core reasoning agent logic (`SimplePersRMAgent`)
- Analyzers and optimizers
- CLI tools for benchmarking and testing
- Plugin infrastructure
- Memory management

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### CLI

```bash
# Run the CLI
npm run cli -- --help

# Example: Run a benchmark
npm run cli -- benchmark run
```

### Using as a library

```javascript
const { SimplePersRMAgent } = require('perslm-core');

// Create a new agent
const agent = new SimplePersRMAgent({
  projectPath: '/path/to/project',
  modelProvider: 'openai',
  modelName: 'gpt-4',
});

// Run a reasoning task
const result = await agent.executeTask({
  type: 'analyze',
  target: '/path/to/file.js',
});

console.log(result);
```

## Benchmarking

```bash
# Run benchmarks
npm run benchmark
```

## Plugins

Plugins extend the capabilities of the core reasoning model. See the [plugin documentation](plugins/README.plugin.md) for more information.

## Integration with Other Modules

### Integration with perslm-uiux-agent

The perslm-uiux-agent module uses perslm-core for its base reasoning capabilities. It imports perslm-core as a dependency.

### Integration with perslm-pyui

The perslm-pyui module can use perslm-core for its reasoning capabilities by importing it as a module.

## Documentation

For more detailed documentation, see the comments in the code and the following files:

- [Plugin System](plugins/README.plugin.md)
- [CLI Documentation](cli/README.md)
- [Benchmark Documentation](benchmarks/README.md) 