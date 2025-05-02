const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');

// Configuration
const PORT = 3001;

// In-memory task storage
const tasks = [
  { 
    id: '1', 
    description: 'Add skeleton loaders', 
    status: 'completed',
    tags: ['UI', 'UX', 'Phase 2'],
    priority: 'medium',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),  // 7 days ago
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),  // 2 days ago
    completionTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  },
  { 
    id: '2', 
    description: 'Implement batch selection system', 
    status: 'in-progress',
    tags: ['Feature', 'UX', 'Phase 2'],
    priority: 'high',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),  // 5 days ago
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),  // 1 day ago
    startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  },
  { 
    id: '3', 
    description: 'Create tag autocomplete', 
    status: 'pending',
    tags: ['UI', 'Phase 2'],
    priority: 'medium',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),  // 4 days ago
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)  // 4 days ago
  },
  { 
    id: '4', 
    description: 'Add undo toast notifications', 
    status: 'pending',
    tags: ['UI', 'UX', 'Phase 2'],
    priority: 'low',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),  // 3 days ago
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)  // 3 days ago
  },
  { 
    id: '5', 
    description: 'Implement calendar drag-to-create', 
    status: 'pending',
    tags: ['Feature', 'Calendar', 'Phase 2'],
    priority: 'high',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),  // 2 days ago
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)  // 2 days ago
  }
];

// Update the HTML template with improved styling and structure
const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <title>PersLM Task Monitor</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* Enhanced styling for better UI */
    :root {
      --primary-color: #4f46e5;
      --primary-hover: #4338ca;
      --secondary-color: #f3f4f6;
      --text-color: #1f2937;
      --light-text: #6b7280;
      --border-color: #e5e7eb;
      --success-color: #10b981;
      --success-bg: #ecfdf5;
      --warning-color: #f59e0b;
      --warning-bg: #fffbeb;
      --error-color: #ef4444;
      --error-bg: #fef2f2;
      --info-color: #3b82f6;
      --info-bg: #eff6ff;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.5;
      color: var(--text-color);
      background-color: #f9fafb;
    }
    
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    
    .card {
      background-color: white;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      transition: box-shadow 0.3s ease, transform 0.2s ease;
    }
    
    .card:hover {
      box-shadow: 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);
    }
    
    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      color: var(--primary-color);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    h1 svg {
      width: 1.75rem;
      height: 1.75rem;
    }
    
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 1rem;
      color: var(--text-color);
    }
    
    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 0.75rem;
    }
    
    p {
      margin-bottom: 1rem;
    }
    
    ul, ol {
      margin-left: 1.5rem;
      margin-bottom: 1.5rem;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
    
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 500;
      font-size: 0.875rem;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      border: none;
      background-color: var(--primary-color);
      color: white;
      cursor: pointer;
      transition: background-color 0.2s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      text-decoration: none;
      gap: 0.5rem;
    }
    
    .btn:hover {
      background-color: var(--primary-hover);
    }
    
    .btn svg {
      width: 1rem;
      height: 1rem;
    }
    
    .btn-sm {
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
    }
    
    .btn-outline {
      background-color: transparent;
      color: var(--primary-color);
      border: 1px solid var(--primary-color);
    }
    
    .btn-outline:hover {
      background-color: var(--primary-color);
      color: white;
    }
    
    .btn-success {
      background-color: var(--success-color);
    }
    
    .btn-success:hover {
      background-color: #0ca678;
    }
    
    .btn-warning {
      background-color: var(--warning-color);
    }
    
    .btn-warning:hover {
      background-color: #d97706;
    }
    
    .btn-danger {
      background-color: var(--error-color);
    }
    
    .btn-danger:hover {
      background-color: #dc2626;
    }
    
    .task {
      display: flex;
      align-items: center;
      padding: 1rem;
      margin-bottom: 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      background-color: white;
      transition: all 0.2s ease;
    }
    
    .task:hover {
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      transform: translateY(-1px);
    }
    
    .task-checkbox {
      margin-right: 0.75rem;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 0.25rem;
      border: 1.5px solid var(--border-color);
      cursor: pointer;
      position: relative;
      transition: all 0.2s ease;
    }
    
    .task-checkbox:checked {
      background-color: var(--primary-color);
      border-color: var(--primary-color);
    }
    
    .task-status {
      width: 1rem;
      height: 1rem;
      border-radius: 50%;
      margin-right: 1rem;
      flex-shrink: 0;
    }
    
    .pending { background-color: var(--light-text); }
    .in-progress { background-color: var(--info-color); }
    .completed { background-color: var(--success-color); }
    .failed { background-color: var(--error-color); }
    
    .task-content {
      flex: 1;
      min-width: 0;
    }
    
    .task-name {
      font-weight: 500;
      margin-bottom: 0.25rem;
      font-size: 0.9375rem;
    }
    
    .completed-text {
      text-decoration: line-through;
      color: var(--light-text);
    }
    
    .task-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-top: 0.25rem;
    }
    
    .task-tag {
      font-size: 0.75rem;
      background-color: var(--info-bg);
      color: var(--info-color);
      padding: 0.125rem 0.5rem;
      border-radius: 1rem;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    
    .task-priority {
      font-size: 0.75rem;
      padding: 0.125rem 0.5rem;
      border-radius: 1rem;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    
    .priority-high {
      background-color: var(--error-bg);
      color: var(--error-color);
    }
    
    .priority-medium {
      background-color: var(--warning-bg);
      color: var(--warning-color);
    }
    
    .priority-low {
      background-color: var(--success-bg);
      color: var(--success-color);
    }
    
    .progress-bar {
      height: 0.5rem;
      background-color: var(--secondary-color);
      border-radius: 1rem;
      margin-bottom: 1.5rem;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background-color: var(--primary-color);
      border-radius: 1rem;
      transition: width 0.3s ease;
    }
    
    .task-actions {
      margin-left: 1rem;
    }
    
    .tabs {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 1.5rem;
    }
    
    .tab {
      padding: 0.75rem 1.25rem;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      font-weight: 500;
      transition: all 0.2s ease;
    }
    
    .tab:hover {
      color: var(--primary-color);
    }
    
    .tab.active {
      border-bottom-color: var(--primary-color);
      color: var(--primary-color);
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    
    @media (min-width: 640px) {
      .stats-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }
    
    .stat-box {
      background-color: white;
      padding: 1.25rem;
      border-radius: 0.5rem;
      text-align: center;
      border: 1px solid var(--border-color);
      transition: all 0.2s ease;
    }
    
    .stat-box:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 0.25rem;
      color: var(--primary-color);
      line-height: 1.2;
    }
    
    .stat-label {
      font-size: 0.875rem;
      color: var(--light-text);
      font-weight: 500;
    }
    
    .floating-button {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      width: 3.5rem;
      height: 3.5rem;
      border-radius: 50%;
      background-color: var(--primary-color);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);
      cursor: pointer;
      font-weight: bold;
      z-index: 50;
      transition: all 0.3s ease;
    }
    
    .floating-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 8px rgba(0,0,0,0.1), 0 3px 6px rgba(0,0,0,0.06);
      background-color: var(--primary-hover);
    }
    
    .badge {
      position: absolute;
      top: -0.375rem;
      right: -0.375rem;
      background-color: var(--error-color);
      color: white;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      border: 2px solid white;
    }
    
    .filter-bar {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }
    
    @media (max-width: 640px) {
      .filter-bar {
        flex-direction: column;
      }
    }
    
    .search-box {
      flex: 1;
      padding: 0.625rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: 0.375rem;
      font-size: 0.875rem;
      transition: all 0.2s ease;
      min-width: 0;
    }
    
    .search-box:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
    }
    
    .batch-actions {
      background-color: var(--info-bg);
      padding: 0.75rem 1rem;
      border-radius: 0.375rem;
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 500;
      font-size: 0.875rem;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    
    .batch-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    
    @media (max-width: 640px) {
      .batch-actions {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }
      
      .batch-buttons {
        width: 100%;
        justify-content: space-between;
      }
    }
    
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
    
    @media (min-width: 768px) {
      .grid-2 {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    
    .form-group {
      margin-bottom: 1rem;
    }
    
    .form-label {
      display: block;
      margin-bottom: 0.375rem;
      font-weight: 500;
      font-size: 0.875rem;
    }
    
    .form-control {
      width: 100%;
      padding: 0.625rem;
      border: 1px solid var(--border-color);
      border-radius: 0.375rem;
      font-size: 0.875rem;
    }
    
    .form-control:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
    }
    
    .actions-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
    
    /* SVG Icons */
    .icon {
      width: 1em;
      height: 1em;
      vertical-align: -0.125em;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
      PersLM Task Monitor
    </h1>
    
    <div class="card">
      <h2>Enhanced Task Monitor</h2>
      <p>The enhanced PersLM Task Monitor includes several new features:</p>
      <ul>
        <li><strong>Batch selection:</strong> Select multiple tasks and perform operations all at once</li>
        <li><strong>Task priorities:</strong> Assign low, medium, high priority to tasks</li>
        <li><strong>Tags:</strong> Organize tasks with multiple tags for better filtering</li>
        <li><strong>Detailed information:</strong> Add notes and context to each task</li>
        <li><strong>Advanced filtering:</strong> Filter by status, priority, or search by text</li>
        <li><strong>Statistics:</strong> View detailed metrics about your progress</li>
      </ul>
      
      <div class="tabs">
        <div class="tab active" onclick="showTab('tasks')">Tasks</div>
        <div class="tab" onclick="showTab('stats')">Statistics</div>
      </div>
      
      <div id="tasks-tab">
        <div class="filter-bar">
          <input type="text" placeholder="Search tasks..." class="search-box">
          <button class="btn btn-outline">
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Filter
          </button>
        </div>
        
        <div class="batch-actions">
          <span>3 tasks selected</span>
          <div class="batch-buttons">
            <button class="btn btn-sm btn-outline">Mark Pending</button>
            <button class="btn btn-sm btn-outline">Start</button>
            <button class="btn btn-sm btn-outline">Complete</button>
          </div>
        </div>
        
        <div class="progress-bar">
          <div class="progress-fill" style="width: 20%;"></div>
        </div>
        
        <div class="tasks">
          <div class="task">
            <input type="checkbox" class="task-checkbox">
            <div class="task-status completed"></div>
            <div class="task-content">
              <div class="task-name completed-text">Add skeleton loaders</div>
              <div class="task-meta">
                <span class="task-tag">UI</span>
                <span class="task-tag">UX</span>
                <span class="task-priority priority-medium">medium</span>
              </div>
            </div>
            <div class="task-actions">
              <button class="btn btn-sm">Edit</button>
            </div>
          </div>
          
          <div class="task">
            <input type="checkbox" class="task-checkbox" checked>
            <div class="task-status in-progress"></div>
            <div class="task-content">
              <div class="task-name">Implement batch selection system</div>
              <div class="task-meta">
                <span class="task-tag">Feature</span>
                <span class="task-tag">UX</span>
                <span class="task-priority priority-high">high</span>
              </div>
            </div>
            <div class="task-actions">
              <button class="btn btn-sm">Edit</button>
            </div>
          </div>
          
          <div class="task">
            <input type="checkbox" class="task-checkbox" checked>
            <div class="task-status pending"></div>
            <div class="task-content">
              <div class="task-name">Create tag autocomplete</div>
              <div class="task-meta">
                <span class="task-tag">UI</span>
                <span class="task-priority priority-medium">medium</span>
              </div>
            </div>
            <div class="task-actions">
              <button class="btn btn-sm">Edit</button>
            </div>
          </div>
          
          <div class="task">
            <input type="checkbox" class="task-checkbox" checked>
            <div class="task-status pending"></div>
            <div class="task-content">
              <div class="task-name">Add undo toast notifications</div>
              <div class="task-meta">
                <span class="task-tag">UI</span>
                <span class="task-tag">UX</span>
                <span class="task-priority priority-low">low</span>
              </div>
            </div>
            <div class="task-actions">
              <button class="btn btn-sm">Edit</button>
            </div>
          </div>
          
          <div class="task">
            <input type="checkbox" class="task-checkbox">
            <div class="task-status pending"></div>
            <div class="task-content">
              <div class="task-name">Implement calendar drag-to-create</div>
              <div class="task-meta">
                <span class="task-tag">Feature</span>
                <span class="task-tag">Calendar</span>
                <span class="task-priority priority-high">high</span>
              </div>
            </div>
            <div class="task-actions">
              <button class="btn btn-sm">Edit</button>
            </div>
          </div>
        </div>
        
        <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem;">
          <input type="text" placeholder="Add new task..." class="search-box">
          <button class="btn">
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add
          </button>
        </div>
      </div>
      
      <div id="stats-tab" style="display: none;">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">1</div>
            <div class="stat-label">Completed</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">1</div>
            <div class="stat-label">In Progress</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">3</div>
            <div class="stat-label">Pending</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">0</div>
            <div class="stat-label">Failed</div>
          </div>
        </div>
        
        <div class="card">
          <h3>Overall Progress</h3>
          <div class="progress-bar">
            <div class="progress-fill" style="width: 20%;"></div>
          </div>
          <div style="text-align: right; font-size: 0.875rem; color: var(--light-text);">20% complete</div>
        </div>
        
        <div class="card">
          <h3>Average Completion Time</h3>
          <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color);">2 days</div>
          <div style="font-size: 0.875rem; color: var(--light-text);">Based on completed tasks</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>How to Use PersLM Task Monitor</h2>
      <div class="grid-2">
        <div>
          <h3>Key Features</h3>
          <ol>
            <li><strong>Batch operations:</strong> Use checkboxes to select multiple tasks and change their status all at once</li>
            <li><strong>Task filtering:</strong> Use the filter button to show only certain task statuses</li>
            <li><strong>Task search:</strong> Search for specific tasks using the search box</li>
            <li><strong>Task details:</strong> Click the edit button to view and edit task details, tags, and priority</li>
            <li><strong>Statistics tab:</strong> View detailed metrics about your tasks and progress</li>
          </ol>
        </div>
        <div>
          <h3>Integration</h3>
          <p>The React implementation includes these components:</p>
          <ul>
            <li><code>TaskMonitor.tsx</code> - Main component for task display</li>
            <li><code>TaskMonitorProvider.tsx</code> - Context provider for state</li>
            <li><code>PersLMTaskMonitor.tsx</code> - Enhanced custom implementation</li>
          </ul>
          
          <p>To access the NextJS version:</p>
          <div class="form-group">
            <code>npm run dev</code> and visit <a href="/task-monitor-demo">/task-monitor-demo</a>
          </div>
          
          <div class="actions-footer">
            <button class="btn btn-success">
              <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div class="floating-button">
    <div class="badge">4</div>
    <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
    </svg>
  </div>
  
  <script>
    function showTab(tabName) {
      // Hide all tabs
      document.getElementById('tasks-tab').style.display = 'none';
      document.getElementById('stats-tab').style.display = 'none';
      
      // Show the selected tab
      document.getElementById(tabName + '-tab').style.display = 'block';
      
      // Update active tab styling
      const tabs = document.querySelectorAll('.tab');
      tabs.forEach(tab => tab.classList.remove('active'));
      
      // Find and activate the clicked tab
      const activeTab = Array.from(tabs).find(tab => tab.textContent.toLowerCase().includes(tabName));
      if (activeTab) activeTab.classList.add('active');
    }
    
    // Add event listeners to checkboxes for better interactivity
    document.addEventListener('DOMContentLoaded', function() {
      const checkboxes = document.querySelectorAll('.task-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
          const task = this.closest('.task');
          if (this.checked) {
            task.style.backgroundColor = '#f9fafb';
          } else {
            task.style.backgroundColor = 'white';
          }
        });
      });
      
      // Initialize the checked state styling
      checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
          checkbox.closest('.task').style.backgroundColor = '#f9fafb';
        }
      });
    });
  </script>
</body>
</html>
`;

// Helper function to parse JSON body from requests
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  
  try {
    // GET /
    if (req.method === 'GET' && pathname === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.statusCode = 200;
      res.end(htmlTemplate);
      return;
    }
    
    // GET /api/tasks
    if (req.method === 'GET' && pathname === '/api/tasks') {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify(tasks));
      return;
    }
    
    // POST /api/tasks
    if (req.method === 'POST' && pathname === '/api/tasks') {
      const body = await parseBody(req);
      const { description, tags = [], priority = 'medium' } = body;
      
      if (!description) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Description is required' }));
        return;
      }
      
      const newTask = {
        id: Date.now().toString(),
        description,
        status: 'pending',
        tags,
        priority,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      tasks.push(newTask);
      res.statusCode = 201;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(newTask));
      return;
    }
    
    // PUT /api/tasks/:id
    if (req.method === 'PUT' && pathname.startsWith('/api/tasks/')) {
      const id = pathname.split('/')[3];
      const body = await parseBody(req);
      const { status, tags, priority, details } = body;
      
      const taskIndex = tasks.findIndex(t => t.id === id);
      if (taskIndex === -1) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Task not found' }));
        return;
      }
      
      const task = tasks[taskIndex];
      const updatedTask = {
        ...task,
        status: status || task.status,
        tags: tags || task.tags,
        priority: priority || task.priority,
        details: details || task.details,
        updatedAt: new Date()
      };
      
      if (status === 'in-progress' && task.status !== 'in-progress') {
        updatedTask.startTime = new Date();
      }
      
      if (status === 'completed' && task.status !== 'completed') {
        updatedTask.completionTime = new Date();
      }
      
      tasks[taskIndex] = updatedTask;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(updatedTask));
      return;
    }
    
    // DELETE /api/tasks/:id
    if (req.method === 'DELETE' && pathname.startsWith('/api/tasks/')) {
      const id = pathname.split('/')[3];
      
      const taskIndex = tasks.findIndex(t => t.id === id);
      if (taskIndex === -1) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Task not found' }));
        return;
      }
      
      tasks.splice(taskIndex, 1);
      res.statusCode = 204;
      res.end();
      return;
    }
    
    // Serve static files from public directory
    if (req.method === 'GET' && pathname.startsWith('/public/')) {
      const filePath = path.join(__dirname, pathname);
      try {
        const data = fs.readFileSync(filePath);
        // Set content type based on file extension
        const ext = path.extname(filePath).toLowerCase();
        const contentType = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml'
        }[ext] || 'text/plain';
        
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.end(data);
        return;
      } catch (error) {
        // File not found
        res.statusCode = 404;
        res.end('File Not Found');
        return;
      }
    }
    
    // Route not found
    res.statusCode = 404;
    res.end('Not Found');
    
  } catch (error) {
    console.error('Server error:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Start server
server.listen(PORT, () => {
  console.log(`
┌─────────────────────────────────────────────────┐
│                                                 │
│   Enhanced PersLM Task Monitor is running!      │
│                                                 │
│   🚀 Open: http://localhost:${PORT}               │
│                                                 │
│   API endpoints available:                      │
│   GET    /api/tasks                             │
│   POST   /api/tasks                             │
│   PUT    /api/tasks/:id                         │
│   DELETE /api/tasks/:id                         │
│                                                 │
│   The full Next.js version requires             │
│   additional dependency setup.                  │
│                                                 │
└─────────────────────────────────────────────────┘
`);
}); 