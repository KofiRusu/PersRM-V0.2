# PersRM Core

This package contains the core reasoning model for PersRM, including the reasoning engine, memory systems, task planning, and execution modules. It is designed to be independent of any UI or integration, making it easy to use in various contexts.

## Features

- Reasoning engine with multiple reasoning strategies
  - Chain of thought reasoning
  - Self-reflection
  - Task decomposition
  - Strategic planning
- Memory system for context persistence
  - Short-term and long-term memory
  - Vector-based retrieval
- Plugin system for extensibility
- CLI commands for analyze/optimize/train/run

## Installation

```bash
npm install persrm-core
```

## Usage

### Basic Reasoning

```typescript
import { ReasoningManager, ReasoningMode } from 'persrm-core';

// Create a model provider (e.g., using an LLM API)
const modelProvider = {
  generate: async (prompt) => {
    // Implementation for generating text from a model
    return "Generated text...";
  }
};

// Create reasoning manager
const reasoningManager = new ReasoningManager(modelProvider);

// Perform reasoning
const result = await reasoningManager.reason("What is the capital of France?");
console.log(result.result?.answer);
```

### With Memory

```typescript
import { ReasoningManager, MemoryManager } from 'persrm-core';

// Create embedding provider
const embeddingProvider = async (text) => {
  // Implementation for generating embeddings
  return [/* vector embeddings */];
};

// Create memory manager
const memoryManager = new MemoryManager({}, embeddingProvider);

// Create reasoning manager with memory
const reasoningManager = new ReasoningManager(modelProvider, {
  memoryManager
});

// Add something to memory
await memoryManager.add("Paris is the capital of France", true);

// Perform reasoning with access to memory
const result = await reasoningManager.reason("What is the capital of France?");
```

## API Reference

### Core Functions

- `startReasoning(query, options)` - Start a reasoning process
- `getRecentSessions(limit)` - Get recent reasoning sessions
- `saveFeedback(sessionId, feedback)` - Save feedback on a reasoning session

### Reasoning

- `ReasoningManager` - Manages reasoning processes
- `ReasoningMode` - Enum of reasoning strategies
- `ReasoningTraceManager` - Manages reasoning traces

### Memory

- `MemoryManager` - Manages memory systems
- `MemorySystem` - Core memory storage and retrieval

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test
``` 