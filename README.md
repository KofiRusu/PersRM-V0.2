# PersRM - Personalized Reasoning Model

PersRM is a personalized reasoning model that provides advanced reasoning capabilities for complex tasks. It features multiple reasoning strategies, memory systems, and integrations with various platforms.

## Project Structure

This is a monorepo containing the following packages:

- **persrm-core**: Core reasoning model and execution logic
  - Reasoning engine (various reasoning strategies)
  - Memory module (short-term and long-term)
  - Task planning and execution
  - Plugin system

- **persrm-ui**: Web/desktop UI built with Next.js
  - Next.js frontend with Tailwind CSS
  - Interactive reasoning interface
  - Session management
  - Visualization components

- **persrm-bridge-anythingllm**: AnythingLLM integration
  - REST API for reasoning
  - WebSocket for real-time updates
  - Compatible with AnythingLLM plugin system

## Getting Started

### Prerequisites

- Node.js 16.x or later
- npm 7.x or later

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/persrm.git
cd persrm

# Install dependencies for all packages
npm install
```

### Development

```bash
# Build all packages
npm run build

# Start UI in development mode
npm run dev

# Start AnythingLLM bridge
cd persrm-bridge-anythingllm
npm run dev
```

## Usage

### Web UI

The web UI will be available at http://localhost:3000 when running the development server.

### AnythingLLM Integration

The AnythingLLM bridge will be available at http://localhost:3100 when running the bridge server.

### API Usage

To use the core reasoning capabilities in your own code:

```typescript
import { startReasoning } from 'persrm-core';

const result = await startReasoning('What are the main applications of transformer models?', {
  mode: 'chain_of_thought',
  saveToMemory: true
});

console.log(result.result.answer);
```

## Package-Specific Documentation

Each package has its own README.md with detailed documentation:

- [persrm-core/README.md](./persrm-core/README.md)
- [persrm-ui/README.md](./persrm-ui/README.md)
- [persrm-bridge-anythingllm/README.md](./persrm-bridge-anythingllm/README.md)

## License

MIT
