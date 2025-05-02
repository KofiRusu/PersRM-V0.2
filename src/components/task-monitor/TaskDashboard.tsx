"use client";

import React, { useState } from "react";
import {
  Search,
  Tag,
  Filter,
  BarChart2,
  CheckCircle,
  Clock,
} from "lucide-react";
import { useTaskMonitor } from "@/context/TaskMonitorContext";
import TaskList from "./TaskList";

export function TaskDashboard() {
  const { tasks } = useTaskMonitor();
  const [activeTab, setActiveTab] = useState("tasks"); // 'tasks', 'testing', 'system'

  // Calculate task statistics
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const pendingTasks = tasks.filter((t) => t.status === "pending").length;
  const inProgressTasks = tasks.filter(
    (t) => t.status === "in-progress",
  ).length;
  const totalTasks = tasks.length;

  const completionPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const highPriorityTasks = tasks.filter((t) => t.priority === "high").length;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Task Monitor</h1>

        {/* Summary Analytics */}
        <div className="hidden md:flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
            <span className="text-muted-foreground">
              {pendingTasks} pending
            </span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div>
            <span className="text-muted-foreground">
              {inProgressTasks} in progress
            </span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
            <span className="text-muted-foreground">
              {completedTasks} completed
            </span>
          </div>
          <div className="text-primary font-medium">
            {completionPercentage}% complete
          </div>
        </div>
      </div>

      {/* Quick Stats for Mobile */}
      <div className="flex md:hidden mb-6 gap-2">
        <div className="bg-card rounded-md p-2 border border-border flex-1 flex items-center">
          <CheckCircle className="text-green-500 h-4 w-4 mr-2" />
          <span className="text-xs">{completedTasks}</span>
        </div>
        <div className="bg-card rounded-md p-2 border border-border flex-1 flex items-center">
          <Clock className="text-yellow-500 h-4 w-4 mr-2" />
          <span className="text-xs">{inProgressTasks}</span>
        </div>
        <div className="bg-card rounded-md p-2 border border-border flex-1">
          <span className="text-xs font-medium">{completionPercentage}%</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex">
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === "tasks"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("tasks")}
          >
            Task Management
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === "testing"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("testing")}
          >
            Testing & Grading
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === "system"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("system")}
          >
            System Overview
          </button>
        </div>
      </div>

      {activeTab === "tasks" && (
        <>
          {/* Task Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tasks..."
                className="rounded-md border border-input pl-9 pr-4 py-2 text-sm w-full md:w-60"
              />
            </div>

            <div className="flex items-center space-x-2">
              <button className="border border-input rounded-md px-3 py-2 text-sm flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </button>

              <div className="flex space-x-1">
                <button className="bg-primary/10 text-primary rounded-md px-3 py-1 text-xs">
                  All
                </button>
                <button className="bg-muted rounded-md px-3 py-1 text-xs">
                  Active
                </button>
                <button className="bg-muted rounded-md px-3 py-1 text-xs">
                  Completed
                </button>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            <div className="bg-muted rounded-full px-3 py-1 text-xs flex items-center">
              <Tag className="h-3 w-3 mr-1" />
              UX Research
            </div>
            <div className="bg-muted rounded-full px-3 py-1 text-xs flex items-center">
              <Tag className="h-3 w-3 mr-1" />
              Design
            </div>
            <div className="bg-muted rounded-full px-3 py-1 text-xs flex items-center">
              <Tag className="h-3 w-3 mr-1" />
              Development
            </div>
            <div className="bg-muted rounded-full px-3 py-1 text-xs flex items-center">
              <Tag className="h-3 w-3 mr-1" />
              Testing
            </div>
            <button className="border border-dashed border-muted-foreground rounded-full px-3 py-1 text-xs">
              + Add Tag
            </button>
          </div>

          {/* Task List */}
          <TaskList />

          {/* Analytics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Task Completion</h3>
              <div className="flex items-end space-x-2">
                <div className="text-2xl font-bold">
                  {completionPercentage}%
                </div>
                <div className="text-xs text-green-600">
                  {completedTasks} of {totalTasks} tasks
                </div>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Status Breakdown</h3>
              <div className="flex items-end space-x-2">
                <div className="text-2xl font-bold">{totalTasks}</div>
                <div className="text-xs">total tasks</div>
              </div>
              <div className="mt-2 flex space-x-1">
                {totalTasks > 0 && (
                  <>
                    <div
                      className="h-2 bg-blue-500 rounded-full"
                      style={{ width: `${(pendingTasks / totalTasks) * 100}%` }}
                    ></div>
                    <div
                      className="h-2 bg-yellow-500 rounded-full"
                      style={{
                        width: `${(inProgressTasks / totalTasks) * 100}%`,
                      }}
                    ></div>
                    <div
                      className="h-2 bg-green-500 rounded-full"
                      style={{
                        width: `${(completedTasks / totalTasks) * 100}%`,
                      }}
                    ></div>
                  </>
                )}
              </div>
              <div className="mt-2 flex text-xs justify-between">
                <div>{pendingTasks} pending</div>
                <div>{inProgressTasks} in progress</div>
                <div>{completedTasks} completed</div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">
                Priority Distribution
              </h3>
              <div className="flex items-end space-x-2">
                <div className="text-2xl font-bold">{highPriorityTasks}</div>
                <div className="text-xs">high priority tasks</div>
              </div>
              <div className="mt-2 flex -space-x-2">
                <div
                  className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center text-xs text-white"
                  title="High priority"
                >
                  H
                </div>
                <div
                  className="h-6 w-6 rounded-full bg-yellow-500 flex items-center justify-center text-xs text-white"
                  title="Medium priority"
                >
                  M
                </div>
                <div
                  className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center text-xs text-white"
                  title="Low priority"
                >
                  L
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "testing" && (
        <div className="p-4 text-center border border-dashed border-border rounded-lg">
          <h3 className="text-lg font-medium mb-2">Testing & Grading</h3>
          <p className="text-muted-foreground">This feature is coming soon.</p>
        </div>
      )}

      {activeTab === "system" && (
        <div className="p-4 text-center border border-dashed border-border rounded-lg">
          <h3 className="text-lg font-medium mb-2">System Overview</h3>
          <p className="text-muted-foreground">This feature is coming soon.</p>
        </div>
      )}
    </div>
  );
}

export default TaskDashboard;
