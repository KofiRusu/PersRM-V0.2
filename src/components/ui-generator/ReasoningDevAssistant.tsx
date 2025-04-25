"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  Send, 
  Maximize2, 
  Minimize2, 
  X, 
  FileCode, 
  PanelLeft, 
  LayoutDashboard,
  Info,
  ChevronsUpDown,
  Copy,
  Code,
  Plus,
  Clipboard,
  BookmarkPlus,
  Router
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Resizable } from "re-resizable";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { openai } from "@/lib/openai";
import { Toast } from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";
import { SessionSwitcher } from "./SessionSwitcher";

type ModelType = "openai" | "deepseek" | "local";

interface ReasoningResponse {
  fullReasoning: string;
  structured: {
    analysis: string;
    approaches: string;
    bestPractices: string;
    accessibility: string;
    implementation: string;
    examples: string;
  };
}

interface GeneratedFile {
  path: string;
  type: string;
}

interface ActivityLog {
  id: string;
  timestamp: Date;
  type: 'reasoning' | 'component' | 'route';
  query: string;
  success: boolean;
}

interface ReasoningDevAssistantProps {
  className?: string;
  defaultExpanded?: boolean;
  animationVariant?: "slide-fade" | "zoom-bounce" | "none";
  sessionId: string;
}

export default function ReasoningDevAssistant({ 
  className, 
  defaultExpanded = true,
  animationVariant = "slide-fade",
  sessionId
}: ReasoningDevAssistantProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<string>("reasoning");
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [lastResponse, setLastResponse] = useState<ReasoningResponse | null>(null);
  const [codeOutput, setCodeOutput] = useState("");
  const [routeOutput, setRouteOutput] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelType>("openai");
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    
    const handleThemeChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleThemeChange);
    
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const startDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && e.target.closest('.no-drag')) {
      return;
    }
    
    setDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const onDrag = (e: MouseEvent) => {
    if (dragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const endDrag = () => {
    setDragging(false);
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', endDrag);
    } else {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', endDrag);
    }
    
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', endDrag);
    };
  }, [dragging]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    
    setLoading(true);
    setLastResponse(null);
    setCodeOutput("");
    setRouteOutput("");
    setActiveTab("reasoning");

    try {
      const result = await fetch("/api/reasoning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          question: query,
          model: selectedModel,
          sessionId: sessionId
        }),
      });

      if (!result.ok) {
        throw new Error("Failed to get reasoning response");
      }

      const data = await result.json();
      setLastResponse(data);
      setActiveTab("reasoning");
      
      // Log activity
      addToActivityLog({
        type: 'reasoning',
        query,
        success: true,
        sessionId: sessionId
      });
      
      toast.success("Reasoning generated successfully!");
    } catch (error) {
      console.error("Error generating reasoning:", error);
      toast({
        title: "Error",
        description: "Failed to generate reasoning. Please try again.",
        variant: "destructive",
      });
      
      // Log failed activity
      addToActivityLog({
        type: 'reasoning',
        query,
        success: false,
        sessionId: sessionId
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCode = async () => {
    if (!lastResponse || loading) return;
    
    setLoading(true);
    setCodeOutput("");
    setActiveTab("code");

    try {
      const result = await fetch("/api/codegen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          reasoning: lastResponse.fullReasoning,
          query,
          sessionId: sessionId
        }),
      });

      if (!result.ok) {
        throw new Error("Failed to generate component");
      }

      const data = await result.json();
      setCodeOutput(data.code);
      setActiveTab("code");
      
      // Log activity
      addToActivityLog({
        type: 'component',
        query,
        success: true,
        sessionId: sessionId
      });
      
      toast.success("Component generated successfully!");
    } catch (error) {
      console.error("Error generating component:", error);
      
      // Log failed activity
      addToActivityLog({
        type: 'component',
        query,
        success: false,
        sessionId: sessionId
      });
      
      toast.error("Failed to generate component. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateRoute = async () => {
    if (!lastResponse || loading) return;
    
    setLoading(true);
    setRouteOutput("");
    setActiveTab("route");

    try {
      const result = await fetch("/api/routegen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          reasoning: lastResponse.fullReasoning,
          query,
          sessionId: sessionId
        }),
      });

      if (!result.ok) {
        throw new Error("Failed to generate route");
      }

      const data = await result.json();
      setRouteOutput(data.route);
      setActiveTab("route");
      
      // Log activity
      addToActivityLog({
        type: 'route',
        query,
        success: true,
        sessionId: sessionId
      });
      
      toast.success(`Successfully generated ${data.files.length} file(s)!`);
    } catch (error) {
      console.error("Error generating route:", error);
      
      // Log failed activity
      addToActivityLog({
        type: 'route',
        query,
        success: false,
        sessionId: sessionId
      });
      
      toast.error(`Failed to generate route: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success("Copied to clipboard!"))
      .catch(() => toast.error("Failed to copy to clipboard"));
  };
  
  interface ActivityLogWithSession extends Omit<ActivityLog, 'id' | 'timestamp'> {
    sessionId: string;
  }

  const addToActivityLog = ({ type, query, success, sessionId }: ActivityLogWithSession) => {
    const newActivity = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      type,
      query,
      success,
      sessionId
    };
    
    setActivityLog(prev => [newActivity, ...prev].slice(0, 20));
    
    // Additionally, log to server for analytics
    fetch("/api/activity-log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newActivity),
    }).catch(err => console.error("Failed to log activity:", err));
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e);
    }
  };

  const examples = [
    "When should I use a modal dialog vs. a slide-over panel?",
    "How should I handle form validation in a multi-step form?",
    "What's the best approach for implementing dark mode in a React application?",
    "How should I design the navigation for a complex web application?",
    "What's the best way to implement infinite scrolling in a React application?"
  ];

  // Define animation variants based on the selected animation type
  const getAnimationVariants = () => {
    switch(animationVariant) {
      case "zoom-bounce":
        return {
          hidden: { opacity: 0, scale: 0.8 },
          visible: { 
            opacity: 1, 
            scale: 1,
            transition: { 
              type: "spring", 
              damping: 12, 
              stiffness: 200 
            }
          },
          exit: { 
            opacity: 0, 
            scale: 0.8,
            transition: { duration: 0.15 }
          }
        };
      case "slide-fade":
        return {
          hidden: { opacity: 0, y: 20 },
          visible: { 
            opacity: 1, 
            y: 0,
            transition: { duration: 0.3 }
          },
          exit: { 
            opacity: 0, 
            y: 20,
            transition: { duration: 0.2 }
          }
        };
      case "none":
      default:
        return {
          hidden: { opacity: 1 },
          visible: { opacity: 1 },
          exit: { opacity: 1 }
        };
    }
  };

  const animationVariants = getAnimationVariants();

  // Log animation variant
  useEffect(() => {
    // This logs which animation variant is being used for analytics
    console.log(`Reasoning assistant using animation variant: ${animationVariant}`);
  }, [animationVariant]);

  if (!expanded) {
    return (
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn("fixed z-50 flex flex-col items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg cursor-pointer hover:shadow-xl transition-all duration-150", 
          className
        )}
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        onClick={() => setExpanded(true)}
        onMouseDown={startDrag}
      >
        <div className="flex items-center justify-center">
          <Code className="h-6 w-6" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      ref={containerRef}
      className={cn(
        "fixed z-50 flex flex-col shadow-xl rounded-lg bg-background border overflow-hidden",
        dragging && "cursor-grabbing opacity-90",
        className
      )}
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        maxWidth: expanded ? "550px" : "300px",
        width: expanded ? "550px" : "300px",
        maxHeight: "90vh",
        transition: "width 0.3s ease, max-width 0.3s ease"
      }}
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={animationVariants}
      onMouseDown={startDrag}
    >
      <div className="flex items-center justify-between p-2 bg-muted/50 border-b no-drag">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5 text-primary" />
          <h3 className="font-medium text-sm">UI Reasoning Assistant</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(false)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex items-center px-2 pt-2 gap-1 bg-background no-drag">
        <div className="flex-1">
          <SessionSwitcher className="mb-2" />
        </div>
      </div>
      
      <div className="flex items-center px-2 pb-2 gap-1 bg-background no-drag">
        <Select value={selectedModel} onValueChange={(value: ModelType) => setSelectedModel(value)}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue placeholder="Select Model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
            <SelectItem value="deepseek">DeepSeek</SelectItem>
            <SelectItem value="local">Local Model</SelectItem>
          </SelectContent>
        </Select>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-8 bg-muted/50">
            <TabsTrigger value="reasoning" className="text-xs h-7">
              Reasoning
            </TabsTrigger>
            <TabsTrigger value="code" className="text-xs h-7" disabled={!codeOutput}>
              Component
            </TabsTrigger>
            <TabsTrigger value="route" className="text-xs h-7" disabled={!routeOutput}>
              Route
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs h-7">
              History
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <div className="flex-1 p-2 overflow-hidden no-drag">
        <TabsContent value="reasoning" className="h-full m-0 p-0">
          <div className="flex flex-col h-full">
            <Textarea
              ref={textareaRef}
              placeholder="Ask about UI/UX patterns, design decisions, or implementation approaches..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-h-0 resize-none text-sm"
            />
            
            <div className="mt-2 flex justify-between items-center">
              <div className="flex flex-wrap gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      <Plus className="h-3 w-3 mr-1" /> Examples
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <div className="p-2">
                      <h4 className="font-medium text-sm mb-2">Example Questions</h4>
                      <div className="space-y-1">
                        {examples.map((example, index) => (
                          <Button
                            key={index}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-xs h-8 font-normal"
                            onClick={() => {
                              setQuery(example);
                              if (textareaRef.current) {
                                textareaRef.current.focus();
                              }
                            }}
                          >
                            {example}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {query.length > 0 ? `${query.length} chars` : ''}
                </span>
                <Button type="button" size="sm" className="h-8" onClick={handleSubmit} disabled={loading || !query.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-3 w-3" />
                      Get Reasoning
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="code" className="h-full m-0 p-0">
          {codeOutput ? (
            <div className="flex flex-col h-full">
              <ScrollArea className="flex-1 pr-4">
                <Card className="p-3 bg-muted/30">
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
                    <code>{codeOutput}</code>
                  </pre>
                </Card>
              </ScrollArea>
              
              <div className="flex justify-between items-center mt-2 pt-2 border-t">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => copyToClipboard(codeOutput)}
                >
                  <Clipboard className="h-3 w-3 mr-1" /> Copy
                </Button>
                
                <Button 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => {
                    // Code to insert component into current editor
                    toast.success("Component would be inserted into current editor");
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Insert in Editor
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">No component generated yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate a component from the Reasoning tab
                </p>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="route" className="h-full m-0 p-0">
          {routeOutput ? (
            <div className="flex flex-col h-full">
              <ScrollArea className="flex-1 pr-4">
                <Card className="p-3 bg-muted/30">
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
                    <code>{routeOutput}</code>
                  </pre>
                </Card>
              </ScrollArea>
              
              <div className="flex justify-between items-center mt-2 pt-2 border-t">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => copyToClipboard(routeOutput)}
                >
                  <Clipboard className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">No route generated yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate a route from the Reasoning tab
                </p>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="history" className="h-full m-0 p-0">
          <ScrollArea className="h-full pr-4">
            {activityLog.length > 0 ? (
              <div className="space-y-2">
                {activityLog.map((log) => (
                  <Card key={log.id} className={cn("p-2 text-xs", !log.success && "border-destructive border-opacity-50")}>
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-1">
                        {log.type === 'reasoning' && <Send className="h-3 w-3 text-primary" />}
                        {log.type === 'component' && <Code className="h-3 w-3 text-primary" />}
                        {log.type === 'route' && <FileCode className="h-3 w-3 text-primary" />}
                        <span className="font-medium">
                          {log.type === 'reasoning' ? 'Reasoning' : log.type === 'component' ? 'Component' : 'Route'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={log.success ? "outline" : "destructive"} className="text-[10px] px-1 py-0 h-5">
                          {log.success ? 'Success' : 'Failed'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Intl.DateTimeFormat('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          }).format(log.timestamp)}
                        </span>
                      </div>
                    </div>
                    <p className="truncate">{log.query}</p>
                    <div className="flex justify-end mt-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-[10px]"
                        onClick={() => {
                          setQuery(log.query);
                          setActiveTab("reasoning");
                        }}
                      >
                        Reuse
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your reasoning and generation history will appear here
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </div>
    </motion.div>
  );
} 