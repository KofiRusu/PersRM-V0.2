'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Copy, Download, Clock, Tag, Edit, Trash2, Clock9 } from 'lucide-react'
import Link from 'next/link'

interface Component {
  id: string
  name: string
  description: string
  code: string
  sourceData: string
  sourceType: string
  createdAt: string
  updatedAt: string
  tags: { id: string; name: string }[]
  versions: {
    id: string
    code: string
    createdAt: string
  }[]
}

export default function ComponentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [component, setComponent] = useState<Component | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('preview')
  const [copied, setCopied] = useState(false)
  
  const componentId = params.id as string

  useEffect(() => {
    const fetchComponent = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/components/${componentId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Component not found')
          }
          throw new Error('Failed to fetch component')
        }
        
        const data = await response.json()
        setComponent(data.component)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to load component',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (componentId) {
      fetchComponent()
    }
  }, [componentId, toast])

  const handleCopyCode = async () => {
    if (!component) return
    
    try {
      await navigator.clipboard.writeText(component.code)
      setCopied(true)
      toast({
        title: 'Code copied',
        description: 'Component code copied to clipboard',
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
      toast({
        title: 'Copy failed',
        description: 'Failed to copy code to clipboard',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteComponent = async () => {
    if (!component) return
    
    if (window.confirm(`Are you sure you want to delete "${component.name}"?`)) {
      try {
        const response = await fetch(`/api/components/${componentId}`, {
          method: 'DELETE',
        })
        
        if (!response.ok) {
          throw new Error('Failed to delete component')
        }
        
        toast({
          title: 'Component deleted',
          description: 'Component has been removed from your library',
        })
        
        // Navigate back to library
        router.push('/components')
      } catch (err) {
        console.error('Failed to delete component:', err)
        toast({
          title: 'Delete failed',
          description: err instanceof Error ? err.message : 'Failed to delete component',
          variant: 'destructive',
        })
      }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-[250px]" />
          <Card>
            <CardHeader>
              <Skeleton className="h-7 w-[200px]" />
              <Skeleton className="h-5 w-[300px] mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[400px] w-full" />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !component) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1" asChild>
              <Link href="/components">
                <ArrowLeft className="h-4 w-4" />
                Back to Library
              </Link>
            </Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>Failed to load component</CardDescription>
            </CardHeader>
            <CardContent>
              <p>{error || 'Component not found'}</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" asChild>
                <Link href="/components">Return to Library</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      pageTitle={component.name}
      pageDescription={component.description || "View component details and code"}
    >
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1" asChild>
              <Link href="/components">
                <ArrowLeft className="h-4 w-4" />
                Back to Library
              </Link>
            </Button>
            <Badge variant={component.sourceType === 'prompt' ? 'default' : 'secondary'}>
              {component.sourceType === 'prompt' ? 'Prompt' : 'Schema'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1"
              onClick={handleCopyCode}
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Copied!' : 'Copy Code'}
            </Button>
            <Button variant="outline" size="sm" className="gap-1">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="destructive" size="sm" className="gap-1" onClick={handleDeleteComponent}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="code">Code</TabsTrigger>
                    <TabsTrigger value="source">Source {component.sourceType === 'prompt' ? 'Prompt' : 'Schema'}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                <TabsContent value="preview" className="m-0 h-[500px]">
                  <div className="border rounded-md h-full flex items-center justify-center p-4">
                    <p className="text-muted-foreground">
                      Live preview would render here in a sandboxed environment
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="code" className="m-0">
                  <ScrollArea className="h-[500px] rounded-md border">
                    <pre className="p-4 text-sm">
                      <code>{component.code}</code>
                    </pre>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="source" className="m-0">
                  <ScrollArea className="h-[500px] rounded-md border">
                    <pre className="p-4 text-sm">
                      <code>{component.sourceData}</code>
                    </pre>
                  </ScrollArea>
                </TabsContent>
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-1 flex items-center gap-1">
                    <Tag className="h-4 w-4" /> Tags
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {component.tags.length > 0 ? (
                      component.tags.map(tag => (
                        <Badge key={tag.id} variant="outline">
                          {tag.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No tags</span>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-1 flex items-center gap-1">
                    <Clock className="h-4 w-4" /> Created
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(component.createdAt)}
                  </p>
                </div>
                
                {component.updatedAt !== component.createdAt && (
                  <div>
                    <h4 className="text-sm font-medium mb-1 flex items-center gap-1">
                      <Edit className="h-4 w-4" /> Last updated
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(component.updatedAt)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Version History</CardTitle>
              </CardHeader>
              <CardContent>
                {component.versions.length > 0 ? (
                  <div className="space-y-3">
                    {component.versions.map((version, index) => (
                      <div 
                        key={version.id} 
                        className={`flex items-center justify-between p-2 rounded-md ${
                          index === 0 ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock9 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {index === 0 ? 'Current' : `Version ${component.versions.length - index}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(version.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {index !== 0 && (
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No version history available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
} 