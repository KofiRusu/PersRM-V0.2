import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startTime?: Date;
  completionTime?: Date;
  tags?: string[];
  details?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

interface TaskMonitorContextType {
  tasks: Task[];
  addTask: (description: string, tags?: string[]) => void;
  updateTaskStatus: (taskId: string, status: Task['status']) => void;
  updateTaskDetails: (taskId: string, details: string) => void;
  updateTaskTags: (taskId: string, tags: string[]) => void;
  updateTaskPriority: (taskId: string, priority: Task['priority']) => void;
  removeTask: (taskId: string) => void;
  clearTasks: () => void;
  completedCount: number;
  pendingCount: number;
  inProgressCount: number;
  failedCount: number;
  completionPercentage: number;
  getAllTags: () => string[];
}

const TaskMonitorContext = createContext<TaskMonitorContextType | undefined>(undefined);

export const useTaskMonitor = () => {
  const context = useContext(TaskMonitorContext);
  if (!context) {
    throw new Error("useTaskMonitor must be used within a TaskMonitorProvider");
  }
  return context;
};

interface TaskMonitorProviderProps {
  children: React.ReactNode;
  persistKey?: string;
}

export function TaskMonitorProvider({ 
  children, 
  persistKey = 'perslm-task-monitor' 
}: TaskMonitorProviderProps) {
  const [tasks, setTasks] = useState<Task[]>(() => {
    // Load tasks from localStorage if available
    if (typeof window !== 'undefined') {
      const savedTasks = localStorage.getItem(persistKey);
      if (savedTasks) {
        try {
          // Parse dates from JSON
          const parsedTasks = JSON.parse(savedTasks);
          return parsedTasks.map((task: any) => ({
            ...task,
            startTime: task.startTime ? new Date(task.startTime) : undefined,
            completionTime: task.completionTime ? new Date(task.completionTime) : undefined,
            createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
            updatedAt: task.updatedAt ? new Date(task.updatedAt) : new Date()
          }));
        } catch (e) {
          console.error("Error parsing saved tasks:", e);
          return [];
        }
      }
    }
    return [];
  });

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(persistKey, JSON.stringify(tasks));
    }
  }, [tasks, persistKey]);

  // Task counts and completion percentage
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'in-progress').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const completionPercentage = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  // Add a new task
  const addTask = (description: string, tags: string[] = []) => {
    const now = new Date();
    const newTask: Task = {
      id: Date.now().toString(),
      description,
      status: 'pending',
      tags,
      createdAt: now,
      updatedAt: now
    };
    setTasks(prev => [...prev, newTask]);
  };

  // Update a task's status
  const updateTaskStatus = (taskId: string, status: Task['status']) => {
    setTasks(prev => 
      prev.map(task => {
        if (task.id === taskId) {
          // Add timestamps based on status change
          let updates: Partial<Task> = { 
            status,
            updatedAt: new Date()
          };
          
          if (status === 'in-progress') {
            updates.startTime = new Date();
          } else if (status === 'completed') {
            updates.completionTime = new Date();
          }
          
          return { ...task, ...updates };
        }
        return task;
      })
    );
  };

  // Update task details
  const updateTaskDetails = (taskId: string, details: string) => {
    setTasks(prev => 
      prev.map(task => {
        if (task.id === taskId) {
          return { 
            ...task, 
            details, 
            updatedAt: new Date() 
          };
        }
        return task;
      })
    );
  };

  // Update task tags
  const updateTaskTags = (taskId: string, tags: string[]) => {
    setTasks(prev => 
      prev.map(task => {
        if (task.id === taskId) {
          return { 
            ...task, 
            tags, 
            updatedAt: new Date() 
          };
        }
        return task;
      })
    );
  };

  // Update task priority
  const updateTaskPriority = (taskId: string, priority: Task['priority']) => {
    setTasks(prev => 
      prev.map(task => {
        if (task.id === taskId) {
          return { 
            ...task, 
            priority, 
            updatedAt: new Date() 
          };
        }
        return task;
      })
    );
  };

  // Remove a task
  const removeTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  // Clear all tasks
  const clearTasks = () => {
    setTasks([]);
  };

  // Get all unique tags
  const getAllTags = () => {
    const allTags: string[] = [];
    tasks.forEach(task => {
      if (task.tags) {
        task.tags.forEach(tag => {
          if (!allTags.includes(tag)) {
            allTags.push(tag);
          }
        });
      }
    });
    return allTags;
  };

  const value = {
    tasks,
    addTask,
    updateTaskStatus,
    updateTaskDetails,
    updateTaskTags,
    updateTaskPriority,
    removeTask,
    clearTasks,
    completedCount,
    pendingCount,
    inProgressCount,
    failedCount,
    completionPercentage,
    getAllTags,
  };

  return (
    <TaskMonitorContext.Provider value={value}>
      {children}
    </TaskMonitorContext.Provider>
  );
} 