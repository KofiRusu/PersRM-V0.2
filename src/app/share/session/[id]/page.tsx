"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Download, Share2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import ReactMarkdown from "react-markdown";

interface Session {
  id: string;
  name: string;
  createdAt: string;
  isShared: boolean;
  metadata?: Record<string, any>;
}

interface SessionActivity {
  id: string;
  timestamp: string;
  type: "reasoning" | "component" | "route";
  query: string;
  response?: {
    fullReasoning?: string;
    structured?: {
      analysis: string;
      approaches: string;
      bestPractices: string;
      accessibility: string;
      implementation: string;
      examples: string;
    };
    code?: string;
    route?: string;
  };
}

export default function SharedSessionPage() {
  const params = useParams();
  const sessionId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [activities, setActivities] = useState<SessionActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("reasoning");
  const [selectedActivity, setSelectedActivity] = useState<SessionActivity | null>(null);
  
  // Fetch session data
  useEffect(() => {
    async function fetchSessionData() {
      try {
        setLoading(true);
        
        // Fetch session details
        const sessionResponse = await fetch(`/api/sessions?id=${sessionId}`);
        if (!sessionResponse.ok) {
          throw new Error(
            sessionResponse.status === 404 
              ? "Session not found or no longer shared" 
              : "Failed to load session"
          );
        }
        
        const sessionData = await sessionResponse.json();
        if (!sessionData.isShared) {
          throw new Error("This session is not currently shared");
        }
        
        setSession(sessionData);
        
        // Fetch session activities
        const activitiesResponse = await fetch(`/api/session-activities?sessionId=${sessionId}`);
        if (activitiesResponse.ok) {
          const activitiesData = await activitiesResponse.json();
          setActivities(activitiesData);
          
          // Select the first activity by default if available
          if (activitiesData.length > 0) {
            setSelectedActivity(activitiesData[0]);
          }
        }
        
        setLoading(false);
      } catch (error) {
        setError(error instanceof Error ? error.message : "An unknown error occurred");
        setLoading(false);
      }
    }
    
    if (sessionId) {
      fetchSessionData();
    }
  }, [sessionId]);
  
  const copyToClipboard = (text: string, label: string = "Content") => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} copied to clipboard`,
      description: "You can now paste it in your project",
    });
  };
  
  const copySessionLink = () => {
    const url = `${window.location.origin}/share/session/${sessionId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Session link copied",
      description: "You can now share this link with others",
    });
  };
  
  const exportSession = () => {
    if (!session) return;
    
    const exportData = {
      session,
      activities,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${session.name.replace(/\s+/g, "-").toLowerCase()}-${session.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Session exported",
      description: "Your session has been downloaded as a JSON file",
    });
  };
  
  // Rendering based on loading/error states
  if (loading) {
    return (
      <div className="container max-w-4xl py-10">
        <Skeleton className="h-12 w-3/4 mb-4" />
        <Skeleton className="h-6 w-1/2 mb-10" />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </div>
          <div className="md:col-span-2">
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container max-w-4xl py-10">
        <Card>
          <CardHeader>
            <CardTitle>Session Unavailable</CardTitle>
            <CardDescription>
              We couldn't load this shared session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container max-w-4xl py-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{session?.name}</h1>
          <p className="text-muted-foreground mt-1">
            Shared on {new Date(session?.createdAt || "").toLocaleDateString()}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copySessionLink}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={exportSession}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Activity list */}
        <div className="md:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Session Activities</CardTitle>
              <CardDescription>
                {activities.length} reasoning {activities.length === 1 ? 'query' : 'queries'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="px-4 pb-4">
                  {activities.length > 0 ? (
                    activities.map((activity) => (
                      <div
                        key={activity.id}
                        className={`p-3 mb-2 rounded-md cursor-pointer hover:bg-muted/80 ${
                          selectedActivity?.id === activity.id ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelectedActivity(activity)}
                      >
                        <p className="font-medium text-sm line-clamp-2">{activity.query}</p>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-muted-foreground">
                            {new Date(activity.timestamp).toLocaleString()}
                          </span>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {activity.type}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No activities in this session
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        
        {/* Activity content */}
        <div className="md:col-span-2">
          {selectedActivity ? (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg pr-4">{selectedActivity.query}</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => copyToClipboard(selectedActivity.query, "Question")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>
                  {new Date(selectedActivity.timestamp).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-0">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-2">
                    <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
                    {selectedActivity.response?.code && (
                      <TabsTrigger value="code">Component</TabsTrigger>
                    )}
                    {selectedActivity.response?.route && (
                      <TabsTrigger value="route">Route</TabsTrigger>
                    )}
                  </TabsList>
                  
                  <ScrollArea className="h-[450px] pr-4">
                    <TabsContent value="reasoning" className="m-0">
                      {selectedActivity.response?.fullReasoning ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>
                            {selectedActivity.response.fullReasoning}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No reasoning content available</p>
                      )}
                    </TabsContent>
                    
                    {selectedActivity.response?.code && (
                      <TabsContent value="code" className="m-0">
                        <Card className="p-3 bg-muted/30">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Generated Component</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => copyToClipboard(selectedActivity.response?.code || "", "Component Code")}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
                            <code>{selectedActivity.response.code}</code>
                          </pre>
                        </Card>
                      </TabsContent>
                    )}
                    
                    {selectedActivity.response?.route && (
                      <TabsContent value="route" className="m-0">
                        <Card className="p-3 bg-muted/30">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Generated Route</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => copyToClipboard(selectedActivity.response?.route || "", "Route Code")}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
                            <code>{selectedActivity.response.route}</code>
                          </pre>
                        </Card>
                      </TabsContent>
                    )}
                  </ScrollArea>
                </Tabs>
              </CardContent>
              <CardFooter className="flex justify-end pt-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(
                    selectedActivity.response?.fullReasoning || "", 
                    "Reasoning"
                  )}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Full Reasoning
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent>
                <p className="text-center text-muted-foreground">
                  {activities.length > 0 
                    ? "Select an activity to view details" 
                    : "No activities available in this session"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
} 