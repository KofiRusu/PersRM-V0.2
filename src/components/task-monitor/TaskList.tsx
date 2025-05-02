"use client";

import React, { useState } from "react";
import {
  CheckCircle,
  Clock,
  MoreVertical,
  CheckSquare,
  Tag,
  Plus,
} from "lucide-react";
import { useTaskMonitor, Task, TaskStatus } from "@/context/TaskMonitorContext";

export function TaskList() {
  const { tasks, updateTaskStatus, addTask } = useTaskMonitor();
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      addTask({
        title: newTaskTitle,
        tags: ["New"],
        priority: "medium",
        status: "pending",
      });
      setNewTaskTitle("");
    }
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center mb-4 space-x-2">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Add new task..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
        />
        <button
          className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm flex items-center"
          onClick={handleAddTask}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add
        </button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 bg-muted p-4 text-xs font-medium text-muted-foreground">
          <div className="col-span-6">Task</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Priority</div>
          <div className="col-span-2">Actions</div>
        </div>

        <div className="divide-y divide-border">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onStatusChange={updateTaskStatus}
              />
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No tasks yet. Add your first task using the form above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TaskItemProps {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

function TaskItem({ task, onStatusChange }: TaskItemProps) {
  const handleStatusChange = (newStatus: TaskStatus) => {
    onStatusChange(task.id, newStatus);
  };

  return (
    <div className="grid grid-cols-12 p-4 items-center hover:bg-muted/50 transition-colors">
      <div className="col-span-6 flex items-center">
        <CheckSquare className="h-4 w-4 mr-2 text-muted-foreground" />
        <div>
          <p className="font-medium">{task.title}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {task.tags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center text-xs bg-muted rounded-full px-2 py-0.5"
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="col-span-2">
        {task.status === "pending" && (
          <span className="bg-blue-100 text-blue-800 rounded-full px-2 py-1 text-xs">
            Pending
          </span>
        )}
        {task.status === "in-progress" && (
          <span className="bg-yellow-100 text-yellow-800 rounded-full px-2 py-1 text-xs">
            In Progress
          </span>
        )}
        {task.status === "completed" && (
          <span className="bg-green-100 text-green-800 rounded-full px-2 py-1 text-xs">
            Completed
          </span>
        )}
      </div>
      <div className="col-span-2">
        {task.priority === "low" && (
          <span className="bg-green-100 text-green-800 rounded-full px-2 py-1 text-xs">
            Low
          </span>
        )}
        {task.priority === "medium" && (
          <span className="bg-yellow-100 text-yellow-800 rounded-full px-2 py-1 text-xs">
            Medium
          </span>
        )}
        {task.priority === "high" && (
          <span className="bg-red-100 text-red-800 rounded-full px-2 py-1 text-xs">
            High
          </span>
        )}
      </div>
      <div className="col-span-2 flex space-x-2">
        {task.status !== "completed" && (
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => handleStatusChange("completed")}
            title="Mark as completed"
          >
            <CheckCircle className="h-4 w-4" />
          </button>
        )}
        {task.status === "pending" && (
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => handleStatusChange("in-progress")}
            title="Start task"
          >
            <Clock className="h-4 w-4" />
          </button>
        )}
        <button className="text-muted-foreground hover:text-foreground">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default TaskList;
