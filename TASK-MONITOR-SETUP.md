# PersLM Task Monitor Setup Guide

This document provides a comprehensive guide for setting up and running the PersLM Task Monitor with all its features.

## Overview

The PersLM Task Monitor is a powerful task management system that offers:

- Task creation, editing, and status tracking
- Task prioritization and tagging
- Batch operations for managing multiple tasks at once
- Detailed statistics and performance metrics
- Search and filtering capabilities
- Mobile-responsive design

The system can be run in two modes:
1. **Standalone Server Mode**: A simple HTTP server with a static UI
2. **Next.js Integration Mode**: A full-featured React application with enhanced UI

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

## Installation

To set up the Task Monitor:

1. Clone the repository or navigate to the project root:
   ```bash
   cd /path/to/PersLM
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Install additional UI dependencies:
   ```bash
   npm install framer-motion tailwindcss postcss autoprefixer next --save
   npm install tailwindcss-animate class-variance-authority clsx lucide-react date-fns --save
   ```

## Running the Task Monitor

### Option 1: Standalone Server Mode

This mode runs a simple HTTP server with a RESTful API and a static UI:

```bash
npm run task-monitor
# or
node run-task-monitor.js
```

The server will start at http://localhost:3001 with the following endpoints:
- GET /api/tasks - Retrieve all tasks
- POST /api/tasks - Create a new task
- PUT /api/tasks/:id - Update an existing task
- DELETE /api/tasks/:id - Delete a task

### Option 2: Next.js Integration Mode

This mode provides a full React application with enhanced UI components:

```bash
npm run dev:next
```

Then visit http://localhost:3000/task-monitor-demo in your browser.

## Key Components

The Task Monitor system consists of three main components:

1. **TaskMonitorProvider** (`components/TaskMonitorProvider.tsx`)
   - Manages task data and state
   - Provides methods for CRUD operations
   - Handles persistence via localStorage

2. **TaskMonitor** (`components/TaskMonitor.tsx`)
   - Core component for displaying tasks
   - Handles task status changes
   - Provides task editing functionality

3. **PersLMTaskMonitor** (`components/PersLMTaskMonitor.tsx`) 
   - Enhanced UI with tabs and floating button
   - Adds batch operations
   - Includes search and filtering
   - Displays statistics

## Configuration

Several aspects of the Task Monitor can be configured:

### Storage Persistence

The `TaskMonitorProvider` accepts a `persistKey` prop to customize the localStorage key:

```jsx
<TaskMonitorProvider persistKey="my-custom-key">
  {/* Components */}
</TaskMonitorProvider>
```

### Default Tasks

You can provide default tasks when using the `PersLMTaskMonitor`:

```jsx
const defaultTasks = [
  { 
    description: 'Example task', 
    status: 'pending',
    tags: ['Example', 'Task'],
    priority: 'medium'
  }
];

<PersLMTaskMonitor defaultTasks={defaultTasks} />
```

## Styling and Customization

The Task Monitor uses a combination of TailwindCSS and custom CSS:

- For the Next.js version, styling is handled through Tailwind classes
- For the standalone server, styling is embedded in the HTML template

### Tailwind Configuration

The project includes a Tailwind configuration in `tailwind.config.js`. You can customize the theme by modifying this file.

## Troubleshooting

### Server Won't Start

If the server fails to start, check for port conflicts:

```bash
lsof -i :3001
```

If another process is using port 3001, you can modify the `PORT` variable in `run-task-monitor.js`.

### Next.js Build Errors

If you encounter errors when building the Next.js app, ensure all dependencies are installed:

```bash
npm install
```

## Contributing

To contribute to the Task Monitor:

1. Ensure components follow the established pattern
2. Use the existing UI components from `components/ui/`
3. Test in both server and Next.js modes

## Additional Resources

- Shadcn/UI documentation: https://ui.shadcn.com/
- Tailwind CSS documentation: https://tailwindcss.com/docs
- Framer Motion documentation: https://www.framer.com/motion/ 