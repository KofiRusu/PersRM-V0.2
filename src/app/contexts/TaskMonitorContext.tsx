"use client"

import { createContext, useContext, useState } from "react"

export type TaskStatus = "pending" | "in-progress" | "completed"
export type TaskPriority = "low" | "medium" | "high"

export interface Task {
  id: string
  title: string
  tags: string[]
  priority: TaskPriority
  status: TaskStatus
}

interface TaskMonitorContextValue {
  tasks: Task[]
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTaskStatus: (id: string, status: TaskStatus) => void
}

const TaskMonitorContext = createContext<TaskMonitorContextValue | undefined>(undefined)

export function TaskMonitorProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([])

  const addTask = (task: Task) => setTasks((prev) => [...prev, task])
  const updateTaskStatus = (id: string, status: TaskStatus) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))

  return (
    <TaskMonitorContext.Provider value={{ tasks, setTasks, addTask, updateTaskStatus }}>
      {children}
    </TaskMonitorContext.Provider>
  )
}

export const useTaskMonitor = () => {
  const ctx = useContext(TaskMonitorContext)
  if (!ctx) throw new Error("useTaskMonitor must be used within a TaskMonitorProvider")
  return ctx
} 