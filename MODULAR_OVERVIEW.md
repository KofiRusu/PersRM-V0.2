# PersLM System - Modular Overview

## Project Structure

The PersLM system has been split into three logically isolated but interoperable modules:

### 1. `perslm-core/`

Base reasoning model infrastructure:
- Core reasoning agent logic (`SimplePersRMAgent`)
- Analyzers and optimizers
- CLI tools
- Plugin system
- Benchmarking tools

### 2. `perslm-uiux-agent/`

UI/UX reasoning capabilities:
- UX enhancement engine
- Session management (including `ExecutionRecoveryService`)
- UI component generation
- Visualization tools

### 3. `perslm-pyui/`

Python-based UI tools:
- Chatbot interface
- Task dashboard
- Standalone Python-based UI

## Running Each System

### perslm-core

```bash
# Install dependencies
cd perslm-core
npm install

# Build
npm run build

# Run CLI
npm run cli -- --help

# Run benchmark
npm run benchmark
```

### perslm-uiux-agent

```bash
# Install dependencies
cd perslm-uiux-agent
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm run start
```

### perslm-pyui

```bash
# Install dependencies
cd perslm-pyui
pip install -r requirements.txt

# Run chatbot interface
python chatbot_interface.py

# Run task dashboard
python task_dashboard.py
```

## Module Interconnections

### perslm-core → perslm-uiux-agent

The perslm-uiux-agent depends on perslm-core for its base reasoning capabilities:

```json
// perslm-uiux-agent/package.json
{
  "dependencies": {
    "perslm-core": "file:../perslm-core"
  }
}
```

### perslm-core/perslm-uiux-agent → perslm-pyui

The perslm-pyui module can use functionality from the other modules by importing them:

```python
# Add the perslm-core directory to the Python path
import sys, os
sys.path.append(os.path.abspath('../perslm-core'))

# Now you can import core modules
from perslm_core.reasoning import reasoner
```

## Data Flow

1. `perslm-core` provides the base reasoning capabilities
2. `perslm-uiux-agent` extends these capabilities with UI/UX-specific reasoning
3. `perslm-pyui` provides a user interface to interact with these capabilities

## Development Workflow

1. Make changes to the core reasoning in `perslm-core`
2. Update the UI/UX agent in `perslm-uiux-agent` to use the new core capabilities
3. Update the Python UI in `perslm-pyui` if needed to expose new functionality

## Testing

Each module has its own testing framework:

- `perslm-core`: Jest
- `perslm-uiux-agent`: Jest
- `perslm-pyui`: Python unittest

## Next Steps

1. Migrate shared code into appropriate modules
2. Update import paths in each module
3. Write integration tests to verify cross-module functionality
4. Create npm scripts for cross-module operations 