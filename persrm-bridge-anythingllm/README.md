# PersRM Bridge for AnythingLLM

This package provides a bridge adapter to integrate PersRM with AnythingLLM and similar platforms. It exposes a REST API and WebSocket interface that wraps the core PersRM reasoning functionality.

## Features

- REST API for PersRM reasoning capabilities
- WebSocket interface for real-time updates
- Compatible with AnythingLLM plugin system
- Configurable endpoints

## Installation

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Start the server
npm start
```

The server will start at http://localhost:3100

## API Endpoints

### Reasoning

- `POST /api/reason` - Start a reasoning process
  - Request body: `{ query: string, context?: string, mode?: string, saveToMemory?: boolean }`
  - Response: `{ success: boolean, result?: { answer: string, reasoning: string }, trace?: { ... } }`

- `POST /api/reason/stream` - Start a reasoning process with streaming response (not yet implemented)

### Sessions

- `GET /api/sessions` - Get recent reasoning sessions
  - Query parameters: `limit` (default: 10)
  - Response: `{ sessions: Array<Session> }`

### Feedback

- `POST /api/feedback` - Save feedback on a reasoning session
  - Request body: `{ sessionId: string, feedback: object }`
  - Response: `{ success: boolean }`

### Health Check

- `GET /health` - Check if the server is running
  - Response: `{ status: "ok" }`

## WebSocket Events

### Client to Server

- `reason` - Start a reasoning process
  - Data: `{ query: string, options?: object }`

### Server to Client

- `reasoning:started` - Reasoning process started
  - Data: `{ query: string }`

- `reasoning:progress` - Reasoning process progress update
  - Data: `{ step: string, stepNumber: number, totalSteps: number }`

- `reasoning:completed` - Reasoning process completed
  - Data: `{ success: boolean, result: object, trace: object }`

- `reasoning:error` - Reasoning process error
  - Data: `{ error: string }`

## Integration with AnythingLLM

To integrate with AnythingLLM, follow these steps:

1. Start the bridge server using `npm start`

2. In AnythingLLM, add a custom tool with the following configuration:
   - Name: PersRM Reasoning
   - Description: Advanced reasoning capabilities with the PersRM engine
   - API Endpoint: http://localhost:3100/api/reason
   - Method: POST
   - Parameters:
     - query: The user's question or task
     - context: Additional context information
     - mode: Optional reasoning mode (chain_of_thought, self_reflection, task_decomposition, planning, auto)

3. Use the tool in conversations by typing `/persrm` followed by your query

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
``` 