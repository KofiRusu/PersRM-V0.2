import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Code, ExternalLink, Search, PlayCircle, Activity } from "lucide-react"

export default function AnalyzerPage() {
  // Placeholder component data
  const components = [
    {
      id: 1,
      name: "TaskList",
      score: 85,
      issues: 2,
      lastUpdated: "2 days ago",
      path: "/components/TaskList.tsx",
    },
    {
      id: 2,
      name: "Header",
      score: 92,
      issues: 1,
      lastUpdated: "5 days ago",
      path: "/components/layout/Header.tsx",
    },
    {
      id: 3,
      name: "Button",
      score: 98,
      issues: 0,
      lastUpdated: "1 week ago",
      path: "/components/ui/button.tsx",
    },
    {
      id: 4,
      name: "Dashboard",
      score: 78,
      issues: 4,
      lastUpdated: "1 day ago",
      path: "/pages/dashboard.tsx",
    },
    {
      id: 5,
      name: "Card",
      score: 90,
      issues: 1,
      lastUpdated: "3 days ago",
      path: "/components/ui/card.tsx",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Component Analyzer</h1>
          <p className="text-muted-foreground">
            Analyze and optimize your UI components
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Search className="h-4 w-4" />
            Scan Project
          </Button>
          <Button className="gap-2">
            <PlayCircle className="h-4 w-4" />
            Run Analysis
          </Button>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-12">
        <Card className="md:col-span-8">
          <CardHeader>
            <CardTitle>Component Analysis</CardTitle>
            <CardDescription>
              Performance and quality metrics for your components
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {components.map((component) => (
                <div
                  key={component.id}
                  className="flex items-center gap-4 p-3 rounded-md hover:bg-muted/50 border-b last:border-0"
                >
                  <Code className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{component.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Last updated: {component.lastUpdated}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">{component.path}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {component.issues > 0 ? (
                      <div className="text-sm text-amber-500">{component.issues} issues</div>
                    ) : (
                      <div className="text-sm text-green-500">No issues</div>
                    )}
                    <div className={`text-sm font-semibold px-2 py-1 rounded-full ${
                      component.score >= 90 
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" 
                        : component.score >= 80
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    }`}>
                      {component.score}%
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ExternalLink className="h-4 w-4" />
                      <span className="sr-only">View details</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <div className="md:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Summary</CardTitle>
              <CardDescription>
                Overall component health
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2 text-center">
                  <div className="text-5xl font-bold">
                    {Math.round(components.reduce((acc, c) => acc + c.score, 0) / components.length)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Average Score
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Quality</div>
                    <div className="text-sm">87%</div>
                  </div>
                  <div className="h-2 bg-secondary rounded-full">
                    <div className="h-full bg-primary rounded-full w-[87%]"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Performance</div>
                    <div className="text-sm">92%</div>
                  </div>
                  <div className="h-2 bg-secondary rounded-full">
                    <div className="h-full bg-primary rounded-full w-[92%]"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Accessibility</div>
                    <div className="text-sm">78%</div>
                  </div>
                  <div className="h-2 bg-secondary rounded-full">
                    <div className="h-full bg-primary rounded-full w-[78%]"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Improvements</CardTitle>
              <CardDescription>
                Component optimizations over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-center justify-center">
                <Activity className="h-32 w-32 text-muted-foreground/20" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 