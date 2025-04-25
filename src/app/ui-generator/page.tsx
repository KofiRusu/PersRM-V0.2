'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import PromptInput from '@/components/ui-generator/PromptInput'
import OutputPreview from '@/components/ui-generator/OutputPreview'
import SchemaUploader from '@/components/ui-generator/SchemaUploader'
import ModelSelector from '@/components/ui-generator/ModelSelector'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { InfoIcon, SparklesIcon, BrainIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { prisma } from '@/lib/db'
import { RouteGenerator } from "@/components/ui-generator/RouteGenerator"
import { Icons } from '@/components/icons'
import ReasoningPanel from "@/components/ui-generator/ReasoningPanel"

export default function UIGeneratorPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('prompt')
  const [model, setModel] = useState('openai')
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null)
  const [currentSchema, setCurrentSchema] = useState<any | null>(null)
  const [reasoningScore, setReasoningScore] = useState<number | null>(null)
  const [modelUsed, setModelUsed] = useState<string | null>(null)
  const [activeFeature, setActiveFeature] = useState<"ui" | "route">("ui")
  const [currentRouteCode, setCurrentRouteCode] = useState<string | null>(null)

  const handlePromptSubmit = async (prompt: string) => {
    setLoading(true)
    setError(null)
    setCurrentPrompt(prompt)
    setCurrentSchema(null)
    setReasoningScore(null)
    setModelUsed(null)
    
    try {
      const response = await fetch('/api/generate-ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model }),
      })
      
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`)
      }
      
      const data = await response.json()
      setCode(data.code)
      
      // Set additional metadata if available
      if (data.reasoningScore) setReasoningScore(data.reasoningScore)
      if (data.modelUsed) setModelUsed(data.modelUsed)
      
      // Automatically save the generated component with a default name
      if (data.code) {
        const defaultName = generateDefaultName(prompt);
        
        try {
          await saveToLibrary(defaultName, '', [], data.code, 'prompt', prompt, data.modelUsed, data.reasoningScore);
        } catch (saveError) {
          console.error('Failed to auto-save component:', saveError);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSchemaSubmit = async (schema: any) => {
    setLoading(true)
    setError(null)
    setCurrentSchema(schema)
    setCurrentPrompt(null)
    setReasoningScore(null)
    setModelUsed(null)
    
    try {
      const response = await fetch('/api/generate-from-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema, model }),
      })
      
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`)
      }
      
      const data = await response.json()
      setCode(data.code)
      
      // Set additional metadata if available
      if (data.reasoningScore) setReasoningScore(data.reasoningScore)
      if (data.modelUsed) setModelUsed(data.modelUsed)
      
      // Automatically save the generated component with a default name
      if (data.code) {
        const schemaTitle = schema.title || 'SchemaForm';
        const defaultName = `${schemaTitle}Component`;
        
        try {
          await saveToLibrary(
            defaultName, 
            'Auto-generated from schema', 
            [], 
            data.code, 
            'schema', 
            JSON.stringify(schema, null, 2),
            data.modelUsed,
            data.reasoningScore
          );
        } catch (saveError) {
          console.error('Failed to auto-save component:', saveError);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleRouteGenerate = (routeCode: string) => {
    setCode(routeCode);
    setCurrentRouteCode(routeCode);
    
    // Auto-save the generated route with a default name
    try {
      const defaultName = `APIRoute_${new Date().toISOString().substring(0, 10)}`;
      saveToLibrary(
        defaultName,
        'API Route', 
        ['route', 'api'], 
        routeCode, 
        'route', 
        '', // We don't store the source data for routes
        model,
        null // No reasoning score for routes
      );
    } catch (error) {
      console.error('Failed to auto-save route:', error);
    }
  };

  // Helper function to generate a default component name from a prompt
  const generateDefaultName = (prompt: string): string => {
    // Extract key terms from the prompt
    let name = prompt
      .split(' ')
      .filter(word => word.length > 3 && /^[A-Za-z]+$/.test(word))
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
    
    return name || 'GeneratedComponent';
  }
  
  // Helper function to save component to library
  const saveToLibrary = async (
    name: string,
    description: string,
    tags: string[],
    code: string,
    type: 'prompt' | 'schema' | 'route',
    sourceData: string,
    modelUsed?: string | null,
    reasoningScore?: number | null
  ) => {
    // Add model and reasoning info to description
    let enhancedDescription = description;
    if (modelUsed) {
      enhancedDescription += ` [Model: ${modelUsed}]`;
    }
    if (reasoningScore) {
      enhancedDescription += ` [Reasoning Score: ${reasoningScore}/10]`;
    }
    
    try {
      const response = await fetch('/api/components/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description: enhancedDescription,
          tags,
          code,
          type,
          sourceData,
          metadata: { modelUsed, reasoningScore }
        })
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to save component:', error);
      throw error;
    }
  };

  // Source data to pass to the OutputPreview
  const sourceData = currentPrompt || (currentSchema ? JSON.stringify(currentSchema, null, 2) : '');
  const sourceType = currentPrompt ? 'prompt' : currentSchema ? 'schema' : 'route';

  return (
    <DashboardLayout
      pageTitle="UI Generator"
      pageDescription="Generate UI components from natural language or JSON schema"
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="schema">Schema</TabsTrigger>
              <TabsTrigger value="reasoning">UI/UX Reasoning</TabsTrigger>
            </TabsList>
          </Tabs>
          <ModelSelector selectedModel={model} onModelChange={setModel} />
        </div>
        
        <Card className="border shadow-sm">
          <CardContent className="p-6">
            <TabsContent value="prompt" className="mt-0">
              <PromptInput
                onSubmit={handlePromptSubmit}
                loading={loading}
              />
            </TabsContent>
            
            <TabsContent value="schema" className="mt-0">
              <SchemaUploader
                onSubmit={handleSchemaSubmit}
                loading={loading}
              />
            </TabsContent>
            
            <TabsContent value="reasoning" className="mt-0">
              <ReasoningPanel />
            </TabsContent>
          </CardContent>
        </Card>
        
        {(code || loading || error) && (
          <Card className="border shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <OutputPreview
                code={code}
                loading={loading}
                error={error}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
} 