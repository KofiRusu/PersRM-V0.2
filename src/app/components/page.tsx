'use client'

import React, { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Code,
  Search,
  Tag,
  Clock,
  Eye,
  Star,
  Trash2,
  Copy,
  Filter,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/use-toast'

interface Component {
  id: string
  name: string
  description: string
  sourceType: string
  createdAt: string
  tags: { id: string; name: string }[]
}

export default function ComponentsLibrary() {
  const [components, setComponents] = useState<Component[]>([])
  const [filteredComponents, setFilteredComponents] = useState<Component[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [tags, setTags] = useState<{ id: string; name: string }[]>([])
  const [activeTab, setActiveTab] = useState('all')
  const { toast } = useToast()

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/components')
        
        if (!response.ok) {
          throw new Error('Failed to fetch components')
        }
        
        const data = await response.json()
        setComponents(data.components)
        setFilteredComponents(data.components)
        
        // Extract unique tags
        const allTags = data.components.flatMap((comp: Component) => comp.tags)
        const uniqueTags = Array.from(
          new Map(allTags.map(tag => [tag.id, tag])).values()
        )
        setTags(uniqueTags)
      } catch (error) {
        console.error('Error fetching components:', error)
        toast({
          title: 'Error fetching components',
          description: 'Please try again later',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchComponents()
  }, [toast])

  // Filter components based on search query and active tag
  useEffect(() => {
    let filtered = components

    // Filter by tab
    if (activeTab === 'prompt') {
      filtered = filtered.filter(comp => comp.sourceType === 'prompt')
    } else if (activeTab === 'schema') {
      filtered = filtered.filter(comp => comp.sourceType === 'schema')
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        comp =>
          comp.name.toLowerCase().includes(query) ||
          comp.description.toLowerCase().includes(query) ||
          comp.tags.some(tag => tag.name.toLowerCase().includes(query))
      )
    }

    // Filter by tag
    if (activeTag) {
      filtered = filtered.filter(comp =>
        comp.tags.some(tag => tag.id === activeTag)
      )
    }

    setFilteredComponents(filtered)
  }, [components, searchQuery, activeTag, activeTab])

  const handleTagClick = (tagId: string) => {
    setActiveTag(prevTag => (prevTag === tagId ? null : tagId))
  }

  const handleDeleteComponent = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this component?')) {
      try {
        const response = await fetch(`/api/components/${id}`, {
          method: 'DELETE',
        })
        
        if (!response.ok) {
          throw new Error('Failed to delete component')
        }
        
        // Remove component from state
        setComponents(prevComponents => 
          prevComponents.filter(comp => comp.id !== id)
        )
        
        toast({
          title: 'Component deleted',
          description: 'Component has been removed from your library',
        })
      } catch (error) {
        console.error('Error deleting component:', error)
        toast({
          title: 'Error deleting component',
          description: 'Please try again',
          variant: 'destructive',
        })
      }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <DashboardLayout
      pageTitle="Component Library"
      pageDescription="Browse, search, and manage your saved UI components"
    >
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="flex items-center gap-2 w-full md:w-[360px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 gap-1">
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </Button>
            
            <Link href="/ui-generator">
              <Button size="sm" className="h-9">
                Create New Component
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex gap-4 flex-col md:flex-row">
          <div className="w-full md:w-[240px] space-y-4">
            <Card>
              <CardHeader className="py-4 px-4">
                <CardTitle className="text-lg">Component Types</CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-0">
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                  orientation="vertical"
                >
                  <TabsList className="flex flex-col items-start h-auto bg-transparent p-0 space-y-1">
                    <TabsTrigger
                      value="all"
                      className="w-full justify-start px-2 py-1 h-9 font-normal"
                    >
                      All Components
                    </TabsTrigger>
                    <TabsTrigger
                      value="prompt"
                      className="w-full justify-start px-2 py-1 h-9 font-normal"
                    >
                      From Prompts
                    </TabsTrigger>
                    <TabsTrigger
                      value="schema"
                      className="w-full justify-start px-2 py-1 h-9 font-normal"
                    >
                      From Schemas
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-4 px-4">
                <CardTitle className="text-lg">Tags</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pt-0 pb-4">
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        className={`cursor-pointer ${
                          activeTag === tag.id
                            ? 'bg-primary'
                            : 'bg-secondary hover:bg-secondary/80'
                        }`}
                        onClick={() => handleTagClick(tag.id)}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No tags found</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex-1">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Components</CardTitle>
                    <CardDescription>
                      {filteredComponents.length} components in your library
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <ComponentSkeleton key={i} />
                    ))}
                  </div>
                ) : filteredComponents.length > 0 ? (
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-4">
                      {filteredComponents.map((component) => (
                        <ComponentCard
                          key={component.id}
                          component={component}
                          onDelete={() => handleDeleteComponent(component.id)}
                          formatDate={formatDate}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="py-12 text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                      <Code className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">No components found</h3>
                    <p className="text-muted-foreground mt-2">
                      {searchQuery || activeTag
                        ? "Try adjusting your search or filter criteria"
                        : "Start by generating and saving components from the UI Generator"}
                    </p>
                    {!components.length && (
                      <Button className="mt-4" asChild>
                        <Link href="/ui-generator">Create Component</Link>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

interface ComponentCardProps {
  component: Component
  onDelete: () => void
  formatDate: (date: string) => string
}

function ComponentCard({ component, onDelete, formatDate }: ComponentCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">{component.name}</CardTitle>
            {component.description && (
              <CardDescription className="mt-1">
                {component.description}
              </CardDescription>
            )}
          </div>
          <Badge variant={component.sourceType === 'prompt' ? 'default' : 'secondary'}>
            {component.sourceType === 'prompt' ? 'Prompt' : 'Schema'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex flex-wrap gap-2 mb-2">
          {component.tags.map((tag) => (
            <Badge key={tag.id} variant="outline" className="text-xs">
              {tag.name}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between pt-0">
        <div className="flex items-center text-xs text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          <span>{formatDate(component.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href={`/components/${component.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-destructive" 
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

function ComponentSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-6 w-[180px]" />
            <Skeleton className="h-4 w-[240px] mt-2" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between pt-0">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </CardFooter>
    </Card>
  )
} 