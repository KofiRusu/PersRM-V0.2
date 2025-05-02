import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function ReasoningPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Reasoning Assistant</h1>
        <p className="text-muted-foreground">
          Leverage advanced reasoning capabilities to solve complex problems.
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Reasoning Query</CardTitle>
            <CardDescription>
              Enter your query to initiate the reasoning process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <textarea
                placeholder="Describe your problem or task here..."
                className="w-full min-h-[100px] p-4 border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex justify-end">
                <Button className="w-full sm:w-auto">
                  Start Reasoning
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
            <CardDescription>
              Previously completed reasoning sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Data Analysis Strategy</p>
                      <p className="text-sm text-muted-foreground">Created 2 days ago</p>
                    </div>
                    <Button variant="ghost" size="sm">View</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Reasoning Metrics</CardTitle>
            <CardDescription>
              Performance insights from your reasoning sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Average Steps</div>
                  <div className="text-sm">12</div>
                </div>
                <div className="h-2 bg-secondary rounded-full">
                  <div className="h-full bg-primary rounded-full w-[60%]"></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Success Rate</div>
                  <div className="text-sm">87%</div>
                </div>
                <div className="h-2 bg-secondary rounded-full">
                  <div className="h-full bg-primary rounded-full w-[87%]"></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Average Time</div>
                  <div className="text-sm">4.2s</div>
                </div>
                <div className="h-2 bg-secondary rounded-full">
                  <div className="h-full bg-primary rounded-full w-[35%]"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Reasoning Visualization</CardTitle>
          <CardDescription>
            Visual representation of the reasoning process
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center border-t bg-muted/30">
          <div className="text-muted-foreground text-center">
            <p className="text-lg">No active reasoning session</p>
            <p className="text-sm">Start a new session to visualize the reasoning process</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 