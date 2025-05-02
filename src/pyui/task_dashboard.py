#!/usr/bin/env python3
"""
# PersLM Task Dashboard

This script creates a web-based task management dashboard to replace the React-based
Task Monitor UI. It provides a simple interface for creating, viewing, and managing
tasks with various priorities and statuses.

## Features:
- Create new tasks with title, tags, priority
- View tasks in a sortable, filterable list
- Update task status (pending, in-progress, completed)
- Filter tasks by status or priority
- Visualize task distribution with charts
- Mobile-friendly responsive design

## Usage:
Run directly with: `python task_dashboard.py`
The dashboard will automatically open in your default web browser.

## Requirements:
- streamlit
- pandas
- webbrowser (standard library)
"""

import sys
import random
import webbrowser
from datetime import datetime
import uuid
import time

# Check for required packages and provide helpful error messages if missing
try:
    import streamlit as st
    import pandas as pd
except ImportError as e:
    missing_package = str(e).split("'")[1]
    print(f"Error: The '{missing_package}' package is required.")
    print(f"Install it with: pip install {missing_package}")
    
    if missing_package == "streamlit":
        print("\nStreamlit is essential for this dashboard.")
        print("Please install it with: pip install streamlit")
    elif missing_package == "pandas":
        print("\nTrying to continue without pandas (some features may be limited)...")
        # Create a minimal pandas-like DataFrame for fallback
        class SimpleDataFrame:
            def __init__(self, data):
                self.data = data
            def to_dict(self, orient):
                return self.data
        pd = type('MockPandas', (), {'DataFrame': SimpleDataFrame})
    else:
        print(f"Unknown package: {missing_package}")
    
    print("\nRetrying with minimal dependencies...")

# Task status and priority types
TASK_STATUS = ["pending", "in-progress", "completed"]
TASK_PRIORITY = ["low", "medium", "high"]

# Status color mapping
STATUS_COLORS = {
    "pending": "#3498db",     # Blue
    "in-progress": "#f39c12", # Orange
    "completed": "#2ecc71"    # Green
}

# Priority color mapping
PRIORITY_COLORS = {
    "low": "#2ecc71",      # Green
    "medium": "#f39c12",   # Orange
    "high": "#e74c3c"      # Red
}

# Sample initial tasks
INITIAL_TASKS = [
    {
        "id": str(uuid.uuid4()),
        "title": "Fix authentication flow",
        "tags": ["Auth", "Bug"],
        "priority": "high",
        "status": "in-progress",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    },
    {
        "id": str(uuid.uuid4()),
        "title": "Improve UI polish on dashboard",
        "tags": ["UI", "Design"],
        "priority": "medium",
        "status": "pending",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    },
    {
        "id": str(uuid.uuid4()),
        "title": "Implement search functionality",
        "tags": ["Feature", "UI"],
        "priority": "high",
        "status": "pending",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    },
    {
        "id": str(uuid.uuid4()),
        "title": "Write documentation",
        "tags": ["Docs"],
        "priority": "low",
        "status": "completed",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
]

def get_priority_emoji(priority):
    """Return an emoji representing the priority level"""
    if priority == "high":
        return "🔴"
    elif priority == "medium":
        return "🟠"
    elif priority == "low":
        return "🟢"
    return ""

def get_status_emoji(status):
    """Return an emoji representing the task status"""
    if status == "completed":
        return "✅"
    elif status == "in-progress":
        return "⏳"
    elif status == "pending":
        return "⏱️"
    return ""

def format_tags(tags):
    """Format tags as colorful badges"""
    return " ".join([f"<span style='background-color: #dfe6e9; padding: 2px 6px; border-radius: 10px; font-size: 0.8em; margin-right: 5px;'>{tag}</span>" for tag in tags])

def create_task_dashboard():
    """Create and display the Streamlit task dashboard"""
    st.set_page_config(
        page_title="PersLM Task Dashboard",
        page_icon="📋",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    # Initialize session state for tasks if not already present
    if 'tasks' not in st.session_state:
        st.session_state.tasks = INITIAL_TASKS
    
    # Main dashboard header
    st.title("📋 Task Monitor Dashboard")
    st.markdown("Manage your tasks, track progress, and visualize your workflow.")
    
    # Create two columns for the layout
    col1, col2 = st.columns([2, 1])
    
    # Task creation form in the sidebar
    with st.sidebar:
        st.header("Create New Task")
        
        task_title = st.text_input("Task Title", placeholder="Enter task title...")
        
        task_tags = st.text_input(
            "Tags (comma separated)", 
            placeholder="UI, Bug, Feature..."
        )
        
        task_priority = st.select_slider(
            "Priority",
            options=TASK_PRIORITY,
            value="medium"
        )
        
        if st.button("Add Task", use_container_width=True):
            if task_title:
                # Parse tags
                tags = [tag.strip() for tag in task_tags.split(",") if tag.strip()]
                if not tags:
                    tags = ["General"]
                
                # Create new task
                new_task = {
                    "id": str(uuid.uuid4()),
                    "title": task_title,
                    "tags": tags,
                    "priority": task_priority,
                    "status": "pending",
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                
                # Add to session state
                st.session_state.tasks.append(new_task)
                st.success(f"Task '{task_title}' created successfully!")
                
                # Clear inputs
                st.experimental_rerun()
            else:
                st.error("Please enter a task title.")
        
        # Sidebar filters
        st.header("Filters")
        
        status_filter = st.multiselect(
            "Filter by Status",
            options=TASK_STATUS,
            default=TASK_STATUS
        )
        
        priority_filter = st.multiselect(
            "Filter by Priority",
            options=TASK_PRIORITY,
            default=TASK_PRIORITY
        )
    
    # Task metrics in the dashboard
    with col1:
        st.subheader("Tasks Overview")
        
        # Apply filters
        filtered_tasks = [
            task for task in st.session_state.tasks
            if task["status"] in status_filter and task["priority"] in priority_filter
        ]
        
        # Convert to DataFrame for easier manipulation
        df = pd.DataFrame(filtered_tasks)
        
        # Show task counts
        total_tasks = len(filtered_tasks)
        
        # Create metrics row
        metrics_cols = st.columns(4)
        
        with metrics_cols[0]:
            st.metric("Total Tasks", total_tasks)
        
        with metrics_cols[1]:
            pending_count = sum(1 for task in filtered_tasks if task["status"] == "pending")
            st.metric("Pending", pending_count)
        
        with metrics_cols[2]:
            in_progress_count = sum(1 for task in filtered_tasks if task["status"] == "in-progress")
            st.metric("In Progress", in_progress_count)
        
        with metrics_cols[3]:
            completed_count = sum(1 for task in filtered_tasks if task["status"] == "completed")
            st.metric("Completed", completed_count)
        
        # Task list
        st.subheader("Task List")
        
        if not filtered_tasks:
            st.info("No tasks match your filters. Try adjusting the filters or add a new task.")
        else:
            # Display tasks as an interactive table
            for i, task in enumerate(filtered_tasks):
                with st.container():
                    cols = st.columns([3, 1, 1, 2])
                    
                    # Task Title and Tags
                    with cols[0]:
                        st.markdown(f"**{task['title']}**")
                        st.markdown(format_tags(task['tags']), unsafe_allow_html=True)
                    
                    # Priority
                    with cols[1]:
                        priority_emoji = get_priority_emoji(task["priority"])
                        st.markdown(f"{priority_emoji} {task['priority'].capitalize()}")
                    
                    # Status
                    with cols[2]:
                        status_emoji = get_status_emoji(task["status"])
                        st.markdown(f"{status_emoji} {task['status'].capitalize()}")
                    
                    # Actions
                    with cols[3]:
                        status_options = [s for s in TASK_STATUS]
                        current_index = status_options.index(task["status"])
                        
                        action_cols = st.columns(3)
                        
                        # Move to next status
                        if task["status"] != "completed":
                            next_status = status_options[(current_index + 1) % len(status_options)]
                            if action_cols[0].button(f"→ {next_status.capitalize()}", key=f"next_{i}"):
                                for t in st.session_state.tasks:
                                    if t["id"] == task["id"]:
                                        t["status"] = next_status
                                st.experimental_rerun()
                        
                        # Change priority
                        new_priority = action_cols[1].selectbox(
                            "Priority",
                            options=TASK_PRIORITY,
                            index=TASK_PRIORITY.index(task["priority"]),
                            key=f"pri_{i}"
                        )
                        
                        if new_priority != task["priority"]:
                            for t in st.session_state.tasks:
                                if t["id"] == task["id"]:
                                    t["priority"] = new_priority
                        
                        # Delete task
                        if action_cols[2].button("🗑️", key=f"del_{i}"):
                            st.session_state.tasks = [t for t in st.session_state.tasks if t["id"] != task["id"]]
                            st.experimental_rerun()
                    
                    st.markdown("---")
    
    # Dashboard charts and statistics
    with col2:
        st.subheader("Task Analytics")
        
        # Status distribution
        status_counts = {}
        for status in TASK_STATUS:
            status_counts[status] = sum(1 for task in filtered_tasks if task["status"] == status)
        
        st.bar_chart(status_counts)
        
        # Priority distribution
        st.subheader("Priority Distribution")
        priority_counts = {}
        for priority in TASK_PRIORITY:
            priority_counts[priority] = sum(1 for task in filtered_tasks if task["priority"] == priority)
        
        st.bar_chart(priority_counts)
        
        # Recent activity
        st.subheader("Recent Activity")
        
        # Sort tasks by created time (newest first)
        sorted_tasks = sorted(
            filtered_tasks, 
            key=lambda x: x.get("created_at", ""), 
            reverse=True
        )[:5]
        
        for task in sorted_tasks:
            st.markdown(
                f"**{task['title']}** - {get_status_emoji(task['status'])} {task['status'].capitalize()}"
            )
            st.markdown(f"<small>{task.get('created_at', 'N/A')}</small>", unsafe_allow_html=True)
            st.markdown("---")

def open_browser():
    """Open the browser to the Streamlit app (if not already open)"""
    webbrowser.open_new("http://localhost:8501")

if __name__ == "__main__":
    try:
        # Try to start the Streamlit app and open the browser
        print("Starting Task Dashboard...")
        create_task_dashboard()
        
        # In the actual script, we wouldn't call open_browser() here
        # because Streamlit starts its own web server and takes over
        # the main thread. Instead, we would include a command to
        # open the browser in a separate thread.
        #
        # For demonstration purposes, we include this, but in practice
        # you would add a callback or a separate thread:
        # import threading
        # threading.Timer(1.5, open_browser).start()
        
    except Exception as e:
        print(f"Error starting Task Dashboard: {e}")
        print("Please make sure Streamlit is installed: pip install streamlit") 