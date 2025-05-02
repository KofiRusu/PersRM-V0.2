#!/usr/bin/env python3
"""
# PersLM Chatbot Interface

This script creates a web-based chatbot interface to interact with the
Task Monitor system's multi-agent backend. It provides a user-friendly way for
non-technical users to interact with the system through natural language.

## Features:
- Simple web UI accessible at localhost
- Chat-based interaction with system agents
- File upload capability for code/logs analysis
- Markdown formatting support for agent messages
- Dark mode styling for comfortable viewing
- System introspection and command execution capabilities
- Dynamic context-aware responses based on system state

## Usage:
Run directly with: `python chatbot_interface.py`
The interface will automatically open in your default web browser.

## Requirements:
- gradio
- webbrowser (standard library)
"""

import os
import time
import sys
import webbrowser
import subprocess
import platform
import json
from datetime import datetime
import random
import re

# Check for required packages and provide helpful error messages if missing
try:
    import gradio as gr
except ImportError:
    print("Error: The 'gradio' package is required. Install it with:")
    print("pip install gradio")
    print("\nRetrying with a fallback UI library...")
    
    try:
        import streamlit as st
        print("Found Streamlit! Using as fallback...")
        USE_STREAMLIT = True
    except ImportError:
        print("Error: Neither 'gradio' nor 'streamlit' is installed.")
        print("Please install at least one of them:")
        print("pip install gradio  # Preferred")
        print("pip install streamlit  # Alternative")
        sys.exit(1)
else:
    USE_STREAMLIT = False

# Sample agent responses
AGENT_RESPONSES = [
    "Welcome to the Multi-Agent System! How can I help you today?",
    "I've analyzed your task list. You have 3 high-priority tasks pending.",
    "Based on your current workload, I recommend focusing on the authentication flow issue first.",
    "I've parsed the log files. There seems to be a permissions issue in the data access layer.",
    "Your current task completion rate is 68%. That's 12% higher than last week!",
    "I've scheduled the deployment for tomorrow at 2:00 PM, as requested.",
    "The performance metrics show a 23% improvement after your recent code changes.",
    "I don't quite understand that request. Could you please rephrase it?",
    "Let me check the documentation for more details on that error message."
]

# Sample chatbot knowledge base
KNOWLEDGE_BASE = {
    "help": "I can help you manage tasks, analyze performance, schedule deployments, and more. Try asking about your tasks or uploading a log file for analysis.",
    "task": "Your current tasks are displayed in the Task Dashboard. You can also ask me to create new tasks or update existing ones.",
    "status": "The system is currently operational. All agents are functioning normally.",
    "priority": "Tasks can be assigned low, medium, or high priority levels.",
    "analytics": "I can provide analytics on task completion rates, performance metrics, and system usage.",
    "schedule": "I can help you schedule deployments, meetings, or other events.",
    "upload": "You can upload log files, code snippets, or other documents for analysis."
}

# Define safe commands that the chatbot can execute
SAFE_COMMANDS = {
    "uptime": {
        "unix": "uptime",
        "windows": "wmic os get lastbootuptime",
        "description": "System uptime information"
    },
    "disk": {
        "unix": "df -h",
        "windows": "wmic logicaldisk get caption,description,freespace,size",
        "description": "Disk space usage"
    },
    "memory": {
        "unix": "free -h",
        "windows": "wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value",
        "description": "Memory usage statistics"
    },
    "cpu": {
        "unix": "top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'",
        "windows": "wmic cpu get loadpercentage",
        "description": "CPU usage information"
    },
    "processes": {
        "unix": "ps aux | head -10",
        "windows": "tasklist | sort /R /+58 | find /v \"System Idle Process\" | head -10",
        "description": "List of top processes"
    },
    "network": {
        "unix": "ifconfig || ip addr",
        "windows": "ipconfig",
        "description": "Network interface information"
    },
    "python_version": {
        "unix": "python --version",
        "windows": "python --version",
        "description": "Installed Python version"
    },
    "whoami": {
        "unix": "whoami",
        "windows": "whoami",
        "description": "Current user"
    }
}

# Local configuration and logs paths to check
LOCAL_PATHS = {
    "task_dashboard": "./src/pyui/task_dashboard.py",
    "chat_interface": "./src/pyui/chatbot_interface.py",
    "readme": "./src/pyui/README.md",
    "logs": "./logs",
    "config": "./config"
}

class ChatHistory:
    """Manages chat message history and agent interactions"""
    
    def __init__(self):
        self.history = []
        self.last_interaction = datetime.now()
        self.system_context = self.gather_system_info()
    
    def add_user_message(self, message):
        """Add a user message to the history"""
        self.history.append(("user", message))
        self.last_interaction = datetime.now()
    
    def add_agent_message(self, message):
        """Add an agent message to the history"""
        self.history.append(("agent", message))
        self.last_interaction = datetime.now()
    
    def get_full_history(self):
        """Get the full chat history"""
        return self.history
    
    def format_for_gradio(self):
        """Format the history for display in Gradio"""
        formatted = []
        for role, message in self.history:
            if role == "user":
                formatted.append([message, None])
            else:
                formatted.append([None, message])
        return formatted
    
    def gather_system_info(self):
        """Gather basic system information for context"""
        system_info = {
            "os": platform.system(),
            "os_version": platform.version(),
            "python_version": platform.python_version(),
            "hostname": platform.node(),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # Check for task data
        try:
            task_data_path = os.path.join(os.path.dirname(__file__), "task_data.json")
            if os.path.exists(task_data_path):
                with open(task_data_path, "r") as f:
                    system_info["task_data"] = json.load(f)
        except Exception as e:
            system_info["task_data_error"] = str(e)
        
        return system_info

def load_local_file(filepath, max_size=10000):
    """
    Safely read local files with size limits
    
    Args:
        filepath: Path to the file to read
        max_size: Maximum number of bytes to read (default: 10KB)
        
    Returns:
        String containing file contents or error message
    """
    try:
        if not os.path.exists(filepath):
            return f"Error: File not found: {filepath}"
        
        if not os.path.isfile(filepath):
            return f"Error: Not a file: {filepath}"
        
        file_size = os.path.getsize(filepath)
        if file_size > max_size:
            with open(filepath, "r") as f:
                content = f.read(max_size) + f"\n... (truncated, {file_size-max_size} bytes remaining)"
        else:
            with open(filepath, "r") as f:
                content = f.read()
        
        return content
    except Exception as e:
        return f"Error reading file {filepath}: {str(e)}"

def run_command_safe(command_key):
    """
    Run a pre-approved system command safely
    
    Args:
        command_key: The key of the command in SAFE_COMMANDS dict
        
    Returns:
        String containing command output or error message
    """
    if command_key not in SAFE_COMMANDS:
        return f"Error: Command '{command_key}' not allowed. Available commands: {', '.join(SAFE_COMMANDS.keys())}"
    
    os_type = "windows" if platform.system().lower() == "windows" else "unix"
    command = SAFE_COMMANDS[command_key][os_type]
    
    try:
        # Use shell=True with caution - all commands are pre-defined
        output = subprocess.check_output(command, shell=True, stderr=subprocess.STDOUT, text=True)
        return f"Command: {command}\nOutput:\n{output}"
    except subprocess.CalledProcessError as e:
        return f"Error executing command '{command}': {e.output}"
    except Exception as e:
        return f"Error: {str(e)}"

def get_task_summary():
    """Get a summary of tasks from the task_dashboard storage"""
    try:
        task_data_path = os.path.join(os.path.dirname(__file__), "task_data.json")
        
        if not os.path.exists(task_data_path):
            # Create sample task data if it doesn't exist
            sample_data = {
                "tasks": [
                    {"title": "Fix authentication flow", "priority": "high", "status": "in-progress"},
                    {"title": "Improve UI polish on dashboard", "priority": "medium", "status": "pending"},
                    {"title": "Implement search functionality", "priority": "high", "status": "pending"},
                    {"title": "Write documentation", "priority": "low", "status": "completed"}
                ]
            }
            with open(task_data_path, "w") as f:
                json.dump(sample_data, f, indent=2)
            return "Sample task data created. Use task_dashboard.py to manage tasks."
        
        with open(task_data_path, "r") as f:
            task_data = json.load(f)
        
        tasks = task_data.get("tasks", [])
        pending = sum(1 for t in tasks if t.get("status") == "pending")
        in_progress = sum(1 for t in tasks if t.get("status") == "in-progress")
        completed = sum(1 for t in tasks if t.get("status") == "completed")
        
        high_priority = sum(1 for t in tasks if t.get("priority") == "high")
        
        summary = f"Task Summary:\n"
        summary += f"• Total Tasks: {len(tasks)}\n"
        summary += f"• Pending: {pending}\n"
        summary += f"• In Progress: {in_progress}\n"
        summary += f"• Completed: {completed}\n"
        summary += f"• High Priority: {high_priority}\n\n"
        
        # List high priority tasks
        if high_priority > 0:
            summary += "High Priority Tasks:\n"
            for i, task in enumerate([t for t in tasks if t.get("priority") == "high"]):
                summary += f"{i+1}. {task.get('title')} ({task.get('status')})\n"
        
        return summary
    except Exception as e:
        return f"Error getting task summary: {str(e)}"

def process_message(message, chat_history, uploaded_file=None):
    """Process a user message and generate an agent response"""
    # Add user message to history
    chat_manager.add_user_message(message)
    
    # Simulate processing time
    time.sleep(0.5)
    
    # Generate response based on message content
    response = generate_response(message, uploaded_file)
    
    # Add agent response to history
    chat_manager.add_agent_message(response)
    
    # Return updated history in Gradio format
    return "", chat_manager.format_for_gradio()

def generate_response(message, uploaded_file=None):
    """Generate an appropriate agent response based on the user message"""
    message = message.lower()
    
    # Process uploaded file if present
    if uploaded_file:
        return f"I've received your file: {os.path.basename(uploaded_file)}. I'll analyze it right away."
    
    # System commands and introspection
    if "system" in message and any(cmd in message for cmd in ["status", "info", "check"]):
        sys_info = chat_manager.system_context
        return f"""System Information:
• Operating System: {sys_info['os']} {sys_info['os_version']}
• Hostname: {sys_info['hostname']}
• Python Version: {sys_info['python_version']}
• Current Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

All systems are operational. The Task Monitor and Chat Interface are running normally."""
    
    # Command execution
    if any(cmd in message for cmd in SAFE_COMMANDS.keys()):
        for cmd in SAFE_COMMANDS.keys():
            if cmd in message:
                return run_command_safe(cmd)
    
    # Specific command patterns
    if re.search(r'(disk|storage|space|drive)(\s+)?(usage|info|status)?', message):
        return run_command_safe("disk")
    
    if re.search(r'(memory|ram)(\s+)?(usage|info|status)?', message):
        return run_command_safe("memory")
    
    if re.search(r'(cpu|processor)(\s+)?(usage|info|load|status)?', message):
        return run_command_safe("cpu")
    
    if re.search(r'(network|internet|connection)(\s+)?(status|info|config)?', message):
        return run_command_safe("network")
    
    if re.search(r'(who am i|current user|username)', message):
        return run_command_safe("whoami")
    
    # File reading queries
    if "read file" in message or "show file" in message or "check file" in message:
        for name, path in LOCAL_PATHS.items():
            if name in message:
                return f"Contents of {name} ({path}):\n\n{load_local_file(path)}"
    
    # Task information
    if "task summary" in message or "task stats" in message or "task status" in message:
        return get_task_summary()
    
    # Check if message matches something in our knowledge base
    for keyword, response in KNOWLEDGE_BASE.items():
        if keyword in message:
            return response
    
    # Check for specific task management commands
    if "create task" in message or "add task" in message:
        task_title = message.replace("create task", "").replace("add task", "").strip()
        if task_title:
            return f"I've created a new task: '{task_title}'. It's been added to your task list with medium priority."
        else:
            return "Please provide a title for the new task. For example: 'Create task Fix login bug'"
    
    if "list tasks" in message or "show tasks" in message or "all tasks" in message:
        return get_task_summary()
    
    # Default to a random response if no specific matches
    return random.choice(AGENT_RESPONSES)

def launch_interface():
    """Launch the appropriate UI based on available libraries"""
    if USE_STREAMLIT:
        launch_streamlit_interface()
    else:
        launch_gradio_interface()

def launch_gradio_interface():
    """Create and launch the Gradio-based chat interface"""
    with gr.Blocks(theme=gr.themes.Soft(primary_hue="blue")) as interface:
        gr.Markdown("# PersLM Multi-Agent Chat Interface")
        gr.Markdown("Interact with the Task Monitor system through this chat interface. Upload files for analysis, ask questions, or request status updates.")
        
        chatbot = gr.Chatbot(
            value=chat_manager.format_for_gradio(),
            height=400,
            show_label=False
        )
        
        with gr.Row():
            msg = gr.Textbox(
                placeholder="Type your message here...",
                show_label=False,
                scale=8
            )
            file = gr.File(
                file_count="single",
                label="Upload File",
                scale=2
            )
        
        btn = gr.Button("Send")
        
        btn.click(
            fn=process_message,
            inputs=[msg, chatbot, file],
            outputs=[msg, chatbot]
        )
        
        msg.submit(
            fn=process_message,
            inputs=[msg, chatbot, file],
            outputs=[msg, chatbot]
        )
        
        gr.Markdown("### Sample commands to try:")
        gr.Markdown("- 'Help' - Get general assistance")
        gr.Markdown("- 'Show tasks' - List your current tasks")
        gr.Markdown("- 'Create task Fix login page' - Create a new task")
        gr.Markdown("- 'System status' - Check system status")
        gr.Markdown("- 'Disk usage' - Check disk space")
        gr.Markdown("- 'Memory usage' - Check RAM status")
        gr.Markdown("- 'Who am I' - Check current user")
        
        # Add a welcome message when the interface loads
        interface.load(
            lambda: process_message("Hello", [], None)[1]
        )
    
    # Run the interface
    url = interface.launch(inbrowser=True, share=False)
    print(f"Chatbot interface is running at: {url}")
    return url

def launch_streamlit_interface():
    """
    This would implement a Streamlit fallback interface,
    but we need to call this script separately as Streamlit
    requires a different execution model.
    """
    print("Streamlit support is enabled as a fallback.")
    print("To use Streamlit, create a file named chatbot_interface_streamlit.py with the Streamlit implementation.")
    print("For now, please install Gradio for the best experience:")
    print("pip install gradio")
    sys.exit(1)

# Initialize the chat manager
chat_manager = ChatHistory()

# Add a welcome message
chat_manager.add_agent_message("Welcome to the Multi-Agent System! How can I help you today?")

if __name__ == "__main__":
    # Launch the appropriate interface
    launch_interface() 