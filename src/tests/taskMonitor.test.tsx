import { render, screen, act } from '@testing-library/react'
import { TaskMonitorProvider, useTaskMonitor } from '../context/TaskMonitorContext'

// Test component that consumes the context
function TestComponent() {
  const { tasks, addTask, updateTaskStatus } = useTaskMonitor()
  
  return (
    <div>
      <div data-testid="task-count">{tasks.length}</div>
      <div data-testid="completed-count">
        {tasks.filter(t => t.status === 'completed').length}
      </div>
      <button 
        data-testid="add-task-btn"
        onClick={() => addTask({
          title: "Test Task",
          tags: ["Test"],
          priority: "medium",
          status: "pending"
        })}
      >
        Add Task
      </button>
      {tasks.map(task => (
        <div key={task.id} data-testid={`task-${task.id}`}>
          <span data-testid={`task-title-${task.id}`}>{task.title}</span>
          <span data-testid={`task-status-${task.id}`}>{task.status}</span>
          <button 
            data-testid={`complete-task-${task.id}`}
            onClick={() => updateTaskStatus(task.id, 'completed')}
          >
            Complete
          </button>
        </div>
      ))}
    </div>
  )
}

describe('TaskMonitor', () => {
  test('adds a task correctly', async () => {
    render(
      <TaskMonitorProvider>
        <TestComponent />
      </TaskMonitorProvider>
    )
    
    // Get initial task count
    const initialTaskCount = parseInt(screen.getByTestId('task-count').textContent || '0')
    
    // Add a new task
    act(() => {
      screen.getByTestId('add-task-btn').click()
    })
    
    // Check if task count increased
    const newTaskCount = parseInt(screen.getByTestId('task-count').textContent || '0')
    expect(newTaskCount).toBe(initialTaskCount + 1)
  })
  
  test('updates task status correctly', async () => {
    render(
      <TaskMonitorProvider>
        <TestComponent />
      </TaskMonitorProvider>
    )
    
    // Add a new task
    act(() => {
      screen.getByTestId('add-task-btn').click()
    })
    
    // Get the added task
    const taskElements = screen.getAllByTestId(/^task-/);
    const lastTask = taskElements[taskElements.length - 1];
    const taskId = lastTask.getAttribute('data-testid')?.replace('task-', '');
    
    if (!taskId) {
      throw new Error('Task ID not found');
    }
    
    // Get initial completed count
    const initialCompletedCount = parseInt(screen.getByTestId('completed-count').textContent || '0')
    
    // Check initial status
    const statusElement = screen.getByTestId(`task-status-${taskId}`);
    expect(statusElement.textContent).toBe('pending');
    
    // Mark task as completed
    act(() => {
      screen.getByTestId(`complete-task-${taskId}`).click()
    })
    
    // Check if status changed
    expect(statusElement.textContent).toBe('completed');
    
    // Check if completed count increased
    const newCompletedCount = parseInt(screen.getByTestId('completed-count').textContent || '0')
    expect(newCompletedCount).toBe(initialCompletedCount + 1)
  })
}) 