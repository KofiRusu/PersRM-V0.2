"use client";

import { createContext, useContext, useState } from "react";
// Uncomment the line below when UUID package is successfully installed
import { v4 as uuidv4 } from "uuid";

// Define the task status and priority types
export type TaskStatus = "pending" | "in-progress" | "completed";
export type TaskPriority = "low" | "medium" | "high";

// Define the Task interface
export interface Task {
  id: string;
  title: string;
  tags: string[];
  priority: TaskPriority;
  status: TaskStatus;
}

// Define the context type
interface TaskMonitorContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, "id">) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
}

// Create the context
const TaskMonitorContext = createContext<TaskMonitorContextType | undefined>(
  undefined,
);

// Example tasks
const initialTasks: Task[] = [
  {
    id: uuidv4(),
    title: "Fix authentication flow",
    tags: ["Auth", "Bug"],
    priority: "high",
    status: "in-progress",
  },
  {
    id: uuidv4(),
    title: "Improve UI polish on dashboard",
    tags: ["UI", "Design"],
    priority: "medium",
    status: "pending",
  },
  {
    id: uuidv4(),
    title: "Implement search functionality",
    tags: ["Feature", "UI"],
    priority: "high",
    status: "pending",
  },
  {
    id: uuidv4(),
    title: "Write documentation",
    tags: ["Docs"],
    priority: "low",
    status: "completed",
  },
];

// Create the Provider component
export function TaskMonitorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  // Add a new task (with auto-generated ID)
  const addTask = (task: Omit<Task, "id">) => {
    const newTask: Task = {
      ...task,
      id: uuidv4(),
    };
    setTasks((prev) => [...prev, newTask]);
  };

  // Update the status of an existing task
  const updateTaskStatus = (taskId: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status } : task)),
    );
  };

  return (
    <TaskMonitorContext.Provider value={{ tasks, addTask, updateTaskStatus }}>
      {children}
    </TaskMonitorContext.Provider>
  );
}

// Custom hook for using the task monitor context
export const useTaskMonitor = () => {
  const context = useContext(TaskMonitorContext);
  if (context === undefined) {
    throw new Error("useTaskMonitor must be used within a TaskMonitorProvider");
  }
  return context;
};
