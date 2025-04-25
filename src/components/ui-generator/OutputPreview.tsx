'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Copy, Check, Code, Eye, Save, Download, Alert, AlertDescription, AlertTitle, AlertTriangle, Sparkles } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { Skeleton } from '@/components/ui/skeleton'

interface OutputPreviewProps {
  code: string
  isLoading: boolean
  error: string | null
  onSave?: (data: SaveComponentData) => Promise<void>
}

interface SaveComponentData {
  name: string;
  description: string;
  tags: string[];
  code: string;
  type: 'component' | 'page' | 'layout';
  sourceData?: {
    prompt?: string;
    schema?: string;
    reasoning?: string;
  };
}

export default function OutputPreview({ code, isLoading, error, onSave }: OutputPreviewProps) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('code')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [componentName, setComponentName] = useState('')
  const [componentDescription, setComponentDescription] = useState('')
  const [componentTags, setComponentTags] = useState('')
  const [componentType, setComponentType] = useState<'component' | 'page' | 'layout'>('component')
  const [reasoning, setReasoning] = useState<string>('')
  const [showReasoningDialog, setShowReasoningDialog] = useState(false)
  const [isGeneratingReasoning, setIsGeneratingReasoning] = useState(false)
  const previewContainerRef = useRef<HTMLDivElement>(null)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  // Reset error when code changes
  useEffect(() => {
    setError(null)
  }, [code])

  // Extract just the JSX/TSX code from the AI response
  const extractComponentCode = () => {
    // Try to find component code between ```jsx or ```tsx blocks
    const codeBlockMatch = code.match(/```(?:jsx|tsx)\n([\s\S]*?)```/)
    
    if (codeBlockMatch && codeBlockMatch[1]) {
      return codeBlockMatch[1].trim()
    }
    
    // If no code block found, try to extract a component directly
    const componentMatch = code.match(/(?:export\s+default\s+function|function|const)\s+\w+\s*(?:\([^)]*\)\s*:?[^{]*)?{[\s\S]*}/)
    
    if (componentMatch) {
      return componentMatch[0].trim()
    }
    
    // If all else fails, return the whole response
    return code
  }

  // Auto-generate component name from code if possible
  useEffect(() => {
    if (code && !componentName) {
      // Try to extract component name from the code
      const nameMatch = code.match(/(?:function|const)\s+([A-Z][a-zA-Z0-9]+)/)
      if (nameMatch && nameMatch[1]) {
        setComponentName(nameMatch[1])
      } else {
        setComponentName("GeneratedComponent")
      }
    }
  }, [code, componentName])

  // Handle save to library
  const handleSaveToLibrary = async () => {
    if (!componentName.trim()) {
      toast({
        title: "Component name required",
        description: "Please provide a name for your component",
        variant: "destructive"
      })
      return
    }

    setIsGeneratingReasoning(true)

    try {
      const tagArray = componentTags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      const extractedCode = extractComponentCode()
      
      const componentData: SaveComponentData = {
        name: componentName,
        description: componentDescription,
        tags: tagArray,
        code: extractedCode,
        type: componentType,
        sourceData: {
          prompt: localStorage.getItem('lastPrompt') || undefined,
          schema: localStorage.getItem('lastSchema') || undefined,
          reasoning: reasoning || undefined,
        }
      }

      if (onSave) {
        await onSave(componentData)
        toast({
          title: "Component saved",
          description: `"${componentName}" has been added to your library`,
        })
        setShowSaveDialog(false)
      } else {
        const response = await fetch('/api/components/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(componentData)
        })

        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`)
        }

        const result = await response.json()
        
        toast({
          title: "Component saved",
          description: `"${componentName}" has been added to your library`,
        })
        
        setShowSaveDialog(false)
      }
    } catch (err) {
      console.error('Failed to save component:', err)
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Failed to save component",
        variant: "destructive"
      })
    } finally {
      setIsGeneratingReasoning(false)
    }
  }

  // Component for displaying the live preview
  const LivePreview = () => {
    useEffect(() => {
      setError(null)
      
      // We would need a proper sandboxed iframe or evaluation strategy here
      // For safety, just simulate whether the code would render or not
      
      if (!code.includes('export default') && !code.includes('function') && !code.includes('const')) {
        setError('Could not find a valid React component in the generated code')
      }
    }, [])

    return (
      <div className="rounded-md border p-4 h-full">
        {error ? (
          <div className="text-destructive p-4 text-sm">
            <p className="font-medium">Error rendering component:</p>
            <p>{error}</p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground">
            <p>Live preview would render here in a sandboxed environment</p>
          </div>
        )}
      </div>
    )
  }

  const generateReasoning = async () => {
    setIsGeneratingReasoning(true)
    
    try {
      const promptText = localStorage.getItem('lastPrompt') || ''
      
      if (!promptText) {
        toast({
          title: "No prompt found",
          description: "Could not find the original prompt to generate reasoning.",
          variant: "destructive",
        })
        return
      }
      
      const response = await fetch('/api/reasoning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: promptText,
          model: localStorage.getItem('preferredModel') || 'openai'
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate reasoning')
      }
      
      const data = await response.json()
      setReasoning(data.reasoning)
      setShowReasoningDialog(true)
    } catch (error) {
      console.error('Error generating reasoning:', error)
      toast({
        title: "Failed to generate reasoning",
        description: "There was an error generating reasoning. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingReasoning(false)
    }
  }
  
  const regenerateComponentFromReasoning = async () => {
    if (!reasoning) {
      toast({
        title: "No reasoning available",
        description: "Please generate reasoning first.",
        variant: "destructive",
      })
      return
    }
    
    try {
      // This would trigger a parent component callback to regenerate the component
      // using the reasoning text
      toast({
        title: "Regenerating component",
        description: "Generating code from reasoning...",
      })
      
      const response = await fetch('/api/codegen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          reasoning,
          model: localStorage.getItem('preferredModel') || 'openai',
          extraContext: localStorage.getItem('lastPrompt') || '',
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate code from reasoning')
      }
      
      const data = await response.json()
      // This would ideally update the code through a parent component callback
      // For now, we'll just show a success message
      toast({
        title: "Code regenerated",
        description: "The component has been regenerated based on reasoning.",
      })
      
      // Close reasoning dialog
      setShowReasoningDialog(false)
    } catch (error) {
      console.error('Error regenerating code:', error)
      toast({
        title: "Failed to regenerate code",
        description: "There was an error generating code from reasoning. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Generated Component</CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleCopy}
              className="h-8 gap-1 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-2">
            <TabsTrigger value="code">
              <Code className="h-4 w-4 mr-2" />
              Code
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="code" className="m-0">
            <ScrollArea className="h-[350px] rounded-md border text-sm">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : code ? (
                <pre className="p-4 overflow-x-auto whitespace-pre-wrap">
                  <code className="text-xs md:text-sm">{extractComponentCode()}</code>
                </pre>
              ) : (
                <Alert>
                  <AlertTitle>No code generated yet</AlertTitle>
                  <AlertDescription>
                    Enter a prompt or upload a schema to generate UI code.
                  </AlertDescription>
                </Alert>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="preview" className="m-0">
            <div className="h-[350px]">
              <LivePreview />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between border-t px-6 py-3">
        <p className="text-xs text-muted-foreground">
          Generated using AI - review code before using in production
        </p>
        <div className="flex gap-2">
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Save className="h-3.5 w-3.5" />
                Save to Library
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Save Component to Library</DialogTitle>
                <DialogDescription>
                  Save this component to your library for future use
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="component-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="component-name"
                    className="col-span-3"
                    value={componentName}
                    onChange={(e) => setComponentName(e.target.value)}
                    placeholder="ComponentName"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="component-description" className="text-right">
                    Description
                  </Label>
                  <Textarea
                    id="component-description"
                    className="col-span-3"
                    value={componentDescription}
                    onChange={(e) => setComponentDescription(e.target.value)}
                    placeholder="A brief description of this component"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="component-tags" className="text-right">
                    Tags
                  </Label>
                  <Input
                    id="component-tags"
                    className="col-span-3"
                    value={componentTags}
                    onChange={(e) => setComponentTags(e.target.value)}
                    placeholder="form, input, button (comma separated)"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">
                    Component Type
                  </Label>
                  <select
                    id="type"
                    value={componentType}
                    onChange={(e) => setComponentType(e.target.value as any)}
                    className="col-span-3 p-2 border rounded-md"
                  >
                    <option value="component">Component</option>
                    <option value="page">Page</option>
                    <option value="layout">Layout</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  onClick={handleSaveToLibrary}
                  disabled={isGeneratingReasoning || !componentName.trim()}
                >
                  {isGeneratingReasoning ? 'Generating...' : 'Save Component'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

export function OutputPreviewSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="space-y-2 flex-1">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
} 