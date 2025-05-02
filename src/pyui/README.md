# PersLM Python UI Tools

This directory contains Python-based replacements for the React-based Task Monitor UI. These tools are designed to be easy to use by non-coders and provide similar functionality to the original web interface.

## Available Tools

### 1. Chatbot Interface (`chatbot_interface.py`)

A web-based chatbot interface for interacting with the Task Monitor system. It allows users to:
- Chat with a simulated multi-agent system
- Upload files for analysis
- Ask questions and get responses about tasks
- Create tasks through natural language commands
- **NEW: Access system information and run safe commands**
- **NEW: View and analyze local files**

#### Usage:
```bash
python chatbot_interface.py
```

#### Requirements:
- gradio (or streamlit as fallback)
- webbrowser (standard library)
- subprocess (standard library)

#### System Access Features:
The chatbot now supports local system introspection with commands like:
- `system status` - Get overview of system information
- `disk usage` - Check disk space
- `memory usage` - Show RAM utilization
- `cpu usage` - Display processor load
- `network status` - See connection information 
- `who am i` - Show current user
- `uptime` - Check system uptime
- `read file [name]` - View contents of predefined files

All commands are executed in a safe, controlled manner with appropriate permissions checks and sanitization.

#### Screenshots:
- The chatbot interface looks similar to modern chat applications with a message history display, input field, and file upload button.

### 2. Task Dashboard (`task_dashboard.py`)

A web-based dashboard for managing tasks. It allows users to:
- Create new tasks with title, tags, and priority
- View tasks in a filterable, sortable list
- Update task status (pending, in-progress, completed)
- Filter tasks by status or priority
- Visualize task distribution with charts

#### Usage:
```bash
python task_dashboard.py
```

#### Requirements:
- streamlit
- pandas
- webbrowser (standard library)

#### Screenshots:
- The dashboard features a sidebar for creating tasks and applying filters, a main task list, and analytics visualizations.

## Installation

To install the required dependencies:

```bash
pip install gradio streamlit pandas
```

Alternatively, you can install minimal dependencies:

```bash
# For chatbot interface only
pip install gradio

# For task dashboard only
pip install streamlit pandas
```

## Fallback Behavior

Both tools include fallback behavior in case of missing dependencies:

- The chatbot interface will try to use Streamlit if Gradio is unavailable
- The task dashboard has a minimal implementation if pandas is unavailable

## Data Storage

The chatbot and task dashboard now share task data through a JSON file:
- `task_data.json` - Contains task information that both tools can access
- Changes made in the task dashboard are visible to the chatbot
- Tasks created via the chatbot can be managed in the dashboard

## For Developers

These Python implementations are designed to be standalone and don't depend on the existing React codebase. They use:

- Gradio/Streamlit for UI rendering
- Python standard library for core functionality
- Web browsers' built-in capabilities for display
- Subprocess for safe system command execution
- File I/O operations with appropriate error handling

### Security Notes

The system access features use a whitelist approach to commands:
- Only predefined commands can be executed
- File access is limited to specific paths
- All operations have appropriate error handling
- Sensitive operations have output size limits

To modify allowed commands, edit the `SAFE_COMMANDS` dictionary in `chatbot_interface.py`. 