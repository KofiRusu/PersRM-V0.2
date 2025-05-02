# PersLM UI/UX Agent (perslm-uiux-agent)

This module contains the UI/UX reasoning capabilities for PersLM, including:

- UX enhancement engine
- Session management
- Execution recovery
- UI component generation
- Visualization tools

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Development Server

```bash
# Run the development server
npm run dev
```

### Production

```bash
# Build for production
npm run build

# Start production server
npm run start
```

## Features

### UX Enhancer

The UX Enhancer analyzes user interfaces and suggests improvements based on usability principles and best practices.

### Execution Recovery

The ExecutionRecoveryService provides resilience to the system by handling execution pauses and recovering from disruptions.

### UI Component Generation

Automatically generates UI components based on specifications and requirements.

## Integration with Other Modules

### Integration with perslm-core

This module depends on perslm-core for its base reasoning capabilities. It imports perslm-core as a dependency.

### Integration with perslm-pyui

The perslm-pyui module can use this module's UI/UX reasoning capabilities by importing it.

## Architecture

- `ux-enhancer/`: UX enhancement engine
- `sessions/`: Session management and execution recovery
- `ui-components/`: UI component generation
- `visualizer/`: Visualization tools for UI/UX analysis 