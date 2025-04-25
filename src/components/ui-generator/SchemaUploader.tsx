'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Upload, FileJson, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SchemaUploaderProps {
  onSubmit: (schema: any) => void
  loading?: boolean
  className?: string
}

export default function SchemaUploader({
  onSubmit,
  loading = false,
  className,
}: SchemaUploaderProps) {
  const [schema, setSchema] = useState('')
  const [activeTab, setActiveTab] = useState('paste')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    if (!schema.trim() || loading) return
    
    try {
      const parsedSchema = JSON.parse(schema.trim())
      setError(null)
      onSubmit(parsedSchema)
    } catch (err) {
      setError('Invalid JSON schema. Please check your input and try again.')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        // Validate JSON before setting
        JSON.parse(content)
        setSchema(content)
        setError(null)
      } catch (err) {
        setError('Invalid JSON file. Please check your file and try again.')
      }
    }
    
    reader.onerror = () => {
      setError('Error reading file. Please try again.')
    }
    
    reader.readAsText(file)
  }

  const handleUseExample = () => {
    const exampleSchema = {
      "title": "Contact Form",
      "description": "A form for collecting user contact information",
      "type": "object",
      "required": ["name", "email"],
      "properties": {
        "name": {
          "type": "string",
          "title": "Full Name",
          "minLength": 2
        },
        "email": {
          "type": "string",
          "title": "Email Address",
          "format": "email"
        },
        "subject": {
          "type": "string",
          "title": "Subject",
          "enum": ["General Inquiry", "Support", "Feedback", "Other"]
        },
        "message": {
          "type": "string",
          "title": "Message",
          "format": "textarea",
          "minLength": 10
        },
        "subscribe": {
          "type": "boolean",
          "title": "Subscribe to newsletter",
          "default": false
        }
      }
    }
    
    setSchema(JSON.stringify(exampleSchema, null, 2))
    setError(null)
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="paste">
            <FileJson className="h-4 w-4 mr-2" />
            Paste JSON
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="paste" className="space-y-4">
          <Textarea
            value={schema}
            onChange={(e) => setSchema(e.target.value)}
            placeholder="Paste your JSON schema here..."
            className="min-h-[200px] font-mono text-sm resize-y"
            disabled={loading}
          />
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseExample}
              disabled={loading}
            >
              Use Example Schema
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!schema.trim() || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate UI"
              )}
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="upload" className="space-y-4">
          <Card className="border-dashed border-2 py-10 flex items-center justify-center flex-col">
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
              disabled={loading}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Select JSON File
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Upload a JSON schema file
            </p>
          </Card>
          {schema && activeTab === 'upload' && (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!schema.trim() || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate UI"
                )}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {schema && !error && (
        <div className="mt-4 p-4 border rounded-md bg-muted/50">
          <Label className="text-sm font-medium">Schema Preview</Label>
          <div className="mt-2 text-xs font-mono">
            <pre className="whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(JSON.parse(schema), null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
} 