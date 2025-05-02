import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Clock, AlertCircle, Plus, Filter, SortDesc } from "lucide-react"

export default function TasksPage() {
  // Placeholder task data
  const tasks = [
    { 
      id: 1, 
      title: "Complete UI design for dashboard", 
      status: "completed", 
      priority: "high",
      tags: ["design", "frontend"],
      dueDate: "2023-10-15"
    },
    { 
      id: 2, 
      title: "Implement authentication service", 
      status: "in-progress", 
      priority: "high",
      tags: ["backend", "security"],
      dueDate: "2023-10-20"
    },
    { 
      id: 3, 
      title: "Optimize database queries", 
      status: "pending", 
      priority: "medium",
      tags: ["backend", "performance"],
      dueDate: "2023-10-25"
    },
    { 
      id: 4, 
      title: "Write unit tests for API endpoints", 
      status: "pending", 
      priority: "medium",
      tags: ["testing", "backend"],
      dueDate: "2023-10-28"
    },
    { 
      id: 5, 
      title: "Fix responsive layout issues", 
      status: "in-progress", 
      priority: "high",
      tags: ["frontend", "bug"],
      dueDate: "2023-10-18"
    },
  ]

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "in-progress":
        return <Clock className="h-5 w-5 text-blue-500" />
      case "pending":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      default:
        return null
    }
  }

  const getPriorityClass = (priority: string) => {
    switch(priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Task Monitor</h1>
          <p className="text-muted-foreground">
            Manage and track all your tasks in one place
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>
      
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{tasks.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {tasks.filter(t => t.status === "in-progress").length}
              </div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {tasks.filter(t => t.status === "completed").length}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </CardContent>
        </Card>
        
        <div className="md:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <Filter className="h-3.5 w-3.5" />
                <span>Filter</span>
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <SortDesc className="h-3.5 w-3.5" />
                <span>Sort</span>
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Showing {tasks.length} tasks
            </div>
          </div>
            
          <div className="bg-background border rounded-md overflow-hidden">
            <div className="space-y-1 p-1">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-4 p-3 border bg-card text-card-foreground rounded-md"
                >
                  {getStatusIcon(task.status)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{task.title}</p>
                      <div className={`text-xs px-2 py-0.5 rounded-full ${getPriorityClass(task.priority)}`}>
                        {task.priority}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {task.tags.map((tag) => (
                        <span 
                          key={tag} 
                          className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground ml-2">
                        Due: {task.dueDate}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">View</Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 