# PersRM Application Runners

This document provides instructions for running the different PersRM applications on separate ports to avoid conflicts.

## Available Applications

Each application runs on its own dedicated port:

| Application    | Port | Script                | URL                          |
|----------------|------|----------------------|------------------------------|
| Task Monitor   | 3015 | `run_task_monitor.py` | http://localhost:3015/tasks  |
| Analyzer       | 3016 | `run_analyzer.py`     | http://localhost:3016/analyzer |
| Reasoning      | 3017 | `run_reasoning.py`    | http://localhost:3017/reasoning |
| Dashboard      | 3018 | `run_dashboard.py`    | http://localhost:3018/dashboard |

## Prerequisites

- Python 3.6+
- Node.js and npm
- Web browser

## Running Applications

Simply execute the desired Python script from your terminal:

```bash
# Run the Task Monitor
python run_task_monitor.py

# Run the Analyzer
python run_analyzer.py

# Run the Reasoning app
python run_reasoning.py

# Run the Dashboard
python run_dashboard.py
```

Each script will:
1. Stop any existing Next.js processes to avoid conflicts
2. Set up the correct environment variables
3. Start the app on its dedicated port
4. Open a browser window to the app URL
5. Display server output for monitoring

## Accessing the Comment System

To test the comment permissions and moderation system:

1. Start the Task Monitor app:
   ```bash
   python run_task_monitor.py
   ```

2. The script will automatically open http://localhost:3015/tasks

3. Click on any task to view its detail page, which will have the comments section

4. The URL will follow this pattern:
   ```
   http://localhost:3015/tasks/{taskId}#comments
   ```

## Troubleshooting

### Port Already in Use

If a port is already in use, the script will attempt to kill existing processes. If that fails:

1. Find the process using the port:
   ```bash
   # macOS/Linux
   lsof -i :3015
   
   # Windows
   netstat -ano | findstr :3015
   ```

2. Kill the process manually:
   ```bash
   # macOS/Linux
   kill -9 <PID>
   
   # Windows
   taskkill /PID <PID> /F
   ```

### Server Fails to Start

If the server fails to start:

1. Check the error output displayed by the script
2. Make sure all necessary dependencies are installed:
   ```bash
   npm install
   ```
3. Check if the PORT environment variable is being properly set
   ```bash
   # macOS/Linux
   PORT=3015 npm run dev
   
   # Windows (PowerShell)
   $env:PORT=3015; npm run dev
   ```

## Stopping the Applications

Press `Ctrl+C` in the terminal where the app is running. The script will gracefully terminate the server process. 