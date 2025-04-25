"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, FileCode, Code, Settings } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ReasoningPanelProps {
  className?: string;
}

interface ReasoningResponse {
  analysis: string;
  approaches: string[];
  bestPractices: string[];
  accessibility: string[];
  implementation: string;
  examples: string;
}

interface GeneratedFile {
  path: string;
  type: string;
}

interface RouteGenerationResponse {
  success: boolean;
  reasoning: string;
  structuredReasoning: any;
  files: GeneratedFile[];
  errors: string[];
}

type ModelType = "openai" | "deepseek" | "local";

export default function ReasoningPanel({ className }: ReasoningPanelProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ReasoningResponse | null>(null);
  const [fullResponse, setFullResponse] = useState<string>("");
  const [activeTab, setActiveTab] = useState("structured");
  const [selectedModel, setSelectedModel] = useState<ModelType>("openai");
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [showCodeGenOptions, setShowCodeGenOptions] = useState(false);
  const [codeGenLoading, setCodeGenLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) {
      toast.error("Please enter a question");
      return;
    }

    setLoading(true);
    setResponse(null);
    setFullResponse("");
    setGeneratedFiles([]);

    try {
      const result = await fetch("/api/reasoning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          question,
          model: selectedModel 
        }),
      });

      if (!result.ok) {
        throw new Error("Failed to get reasoning response");
      }

      const data = await result.json();
      setResponse(data.structuredResponse);
      setFullResponse(data.fullResponse);
      toast.success("Reasoning generated successfully!");
    } catch (error) {
      console.error("Error getting reasoning:", error);
      toast.error("Failed to get reasoning response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuestion(example);
  };

  const generateCodeFromReasoning = async () => {
    if (!fullResponse) {
      toast.error("No reasoning available to generate code");
      return;
    }

    setCodeGenLoading(true);
    setGeneratedFiles([]);

    try {
      const result = await fetch("/api/generate-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: question,
        }),
      });

      if (!result.ok) {
        throw new Error("Failed to generate code");
      }

      const data: RouteGenerationResponse = await result.json();
      
      if (data.success) {
        setGeneratedFiles(data.files);
        toast.success(`Successfully generated ${data.files.length} file(s)!`);
      } else {
        toast.error(`Code generation failed: ${data.errors.join(', ')}`);
      }
    } catch (error) {
      console.error("Error generating code:", error);
      toast.error("Failed to generate code. Please try again.");
    } finally {
      setCodeGenLoading(false);
      setShowCodeGenOptions(false);
    }
  };

  const examples = [
    "When should I use a modal dialog vs. a slide-over panel?",
    "How should I handle form validation in a multi-step form?",
    "What's the best approach for implementing dark mode in a React application?",
    "How should I design the navigation for a complex web application?",
    "What's the best way to implement infinite scrolling in a React application?"
  ];

  const codeExamples = [
    "Create a feedback form page with validation and API endpoint",
    "Build a user profile settings page with avatar upload",
    "Design a product listing page with filtering and sorting",
    "Implement a dashboard layout with sidebar navigation",
    "Create a multi-step checkout process with order summary"
  ];

  return (
    <div className={`flex flex-col space-y-4 h-full ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-2">
              <Label htmlFor="model-selector">Model:</Label>
              <Select value={selectedModel} onValueChange={(value: ModelType) => setSelectedModel(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                  <SelectItem value="deepseek">DeepSeek Coder</SelectItem>
                  <SelectItem value="local">Local Model</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  API Settings
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>API Settings</DialogTitle>
                  <DialogDescription>
                    Configure API keys and model settings
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="openai-key">OpenAI API Key</Label>
                    <Input 
                      id="openai-key" 
                      type="password" 
                      placeholder="sk-..." 
                      // In a real implementation, we'd load and save this to localStorage
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="local-url">Local Model URL</Label>
                    <Input 
                      id="local-url" 
                      placeholder="http://localhost:8000" 
                      defaultValue="http://localhost:11434"
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <Textarea
            placeholder="Ask about UI/UX patterns, design decisions, or implementation approaches..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-[120px] resize-none"
          />
          <div className="flex justify-between items-center">
            <div className="flex flex-wrap gap-2">
              <Tabs defaultValue="reasoning" className="w-full">
                <TabsList className="mb-2">
                  <TabsTrigger value="reasoning">Reasoning Examples</TabsTrigger>
                  <TabsTrigger value="code">Code Gen Examples</TabsTrigger>
                </TabsList>
                <TabsContent value="reasoning" className="m-0">
                  <div className="flex flex-wrap gap-2">
                    {examples.map((example, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => handleExampleClick(example)}
                        className="text-xs"
                      >
                        {example.length > 30 ? example.substring(0, 30) + "..." : example}
                      </Button>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="code" className="m-0">
                  <div className="flex flex-wrap gap-2">
                    {codeExamples.map((example, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => handleExampleClick(example)}
                        className="text-xs"
                      >
                        {example.length > 30 ? example.substring(0, 30) + "..." : example}
                      </Button>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <Button type="submit" disabled={loading || !question.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Get Reasoning
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {response && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Reasoning Results</h3>
            <div className="flex space-x-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={codeGenLoading}>
                    <FileCode className="mr-2 h-4 w-4" />
                    Generate Route
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Generate Route Files</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will analyze the reasoning and generate complete route files including page components and API endpoints. The files will be created in your project.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={generateCodeFromReasoning}
                      disabled={codeGenLoading}
                    >
                      {codeGenLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : "Generate Files"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <Button variant="outline" size="sm">
                <Code className="mr-2 h-4 w-4" />
                Generate Component
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="structured">Structured</TabsTrigger>
              <TabsTrigger value="full">Full Response</TabsTrigger>
              <TabsTrigger value="files" disabled={generatedFiles.length === 0}>
                Generated Files ({generatedFiles.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="structured" className="flex-1 overflow-auto">
              <div className="space-y-4 p-2">
                <Card className="p-4">
                  <h3 className="font-semibold mb-2">Analysis</h3>
                  <ReactMarkdown className="prose prose-sm dark:prose-invert">
                    {response.analysis}
                  </ReactMarkdown>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-2">Approaches</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    {response.approaches.map((approach, index) => (
                      <li key={index}>
                        <ReactMarkdown className="prose prose-sm dark:prose-invert">
                          {approach}
                        </ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-2">Best Practices</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    {response.bestPractices.map((practice, index) => (
                      <li key={index}>
                        <ReactMarkdown className="prose prose-sm dark:prose-invert">
                          {practice}
                        </ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-2">Accessibility Considerations</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    {response.accessibility.map((item, index) => (
                      <li key={index}>
                        <ReactMarkdown className="prose prose-sm dark:prose-invert">
                          {item}
                        </ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-2">Implementation Tips</h3>
                  <ReactMarkdown className="prose prose-sm dark:prose-invert">
                    {response.implementation}
                  </ReactMarkdown>
                </Card>

                {response.examples && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Examples</h3>
                    <ReactMarkdown className="prose prose-sm dark:prose-invert">
                      {response.examples}
                    </ReactMarkdown>
                  </Card>
                )}
              </div>
            </TabsContent>
            <TabsContent value="full" className="flex-1 overflow-auto">
              <Card className="p-4 h-full">
                <ReactMarkdown className="prose prose-sm dark:prose-invert">
                  {fullResponse}
                </ReactMarkdown>
              </Card>
            </TabsContent>
            <TabsContent value="files" className="flex-1 overflow-auto">
              <Card className="p-4 h-full">
                <h3 className="font-semibold mb-4">Generated Files</h3>
                {generatedFiles.length > 0 ? (
                  <div className="space-y-2">
                    {generatedFiles.map((file, index) => (
                      <div key={index} className="flex items-center p-2 border rounded-md">
                        <FileCode className="h-5 w-5 mr-2 text-primary" />
                        <div>
                          <p className="font-medium">{file.path}</p>
                          <p className="text-xs text-muted-foreground">Type: {file.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No files generated yet.</p>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">
            Analyzing your question and preparing a comprehensive response...
          </p>
        </div>
      )}

      {!response && !loading && (
        <div className="flex-1 flex items-center justify-center p-4 text-center border-2 border-dashed rounded-lg">
          <div>
            <p className="text-muted-foreground mb-2">
              Ask any question about UI/UX patterns, design decisions, or implementation approaches
            </p>
            <p className="text-xs text-muted-foreground">
              Examples: "When should I use infinite scroll vs. pagination?", "How to design an accessible dropdown menu?"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}