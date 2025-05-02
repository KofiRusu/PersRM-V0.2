# PersLM Python UI (perslm-pyui)

This module provides Python-based UI tools for the PersLM system, including a chatbot interface and task dashboard.

## Available Tools

### 1. Chatbot Interface (`chatbot_interface.py`)

A web-based chatbot interface for interacting with the Task Monitor system. It allows users to:
- Chat with a simulated multi-agent system
- Upload files for analysis
- Ask questions and get responses about tasks
- Create tasks through natural language commands
- Access system information and run safe commands
- View and analyze local files

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
pip install -r requirements.txt
```

Alternatively, you can install minimal dependencies:

```bash
# For chatbot interface only
pip install gradio

# For task dashboard only
pip install streamlit pandas
```

## Standalone Operation

This module is designed to function independently of the other PersLM modules. All necessary functionality is contained within this directory.

## Integration with Other Modules

### Integration with perslm-core

To use core reasoning capabilities from perslm-core:

```python
import sys
import os

# Add the perslm-core directory to the Python path
sys.path.append(os.path.abspath('../perslm-core'))

# Now you can import core modules
from perslm_core.reasoning import reasoner
```

### Integration with perslm-uiux-agent

To use UI/UX reasoning capabilities:

```python
import sys
import os

# Add the perslm-uiux-agent directory to the Python path
sys.path.append(os.path.abspath('../perslm-uiux-agent'))

# Now you can import UI/UX modules
from perslm_uiux_agent.services import ui_generation
```

## Data Storage

The chatbot and task dashboard share task data through a JSON file:
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