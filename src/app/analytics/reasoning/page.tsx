'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Brain, TrendingUp, BarChart, Download, RefreshCcw } from 'lucide-react'

interface ReasoningLog {
  id: string
  createdAt: string
  prompt: string
  model: string
  score: number
  responseTime?: number
}

export default function ReasoningAnalytics() {
  const [logs, setLogs] = useState<ReasoningLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('all')
  const [modelFilter, setModelFilter] = useState('all')
  
  // Stats for dashboard
  const [stats, setStats] = useState({
    totalTests: 0,
    averageScore: 0,
    modelPerformance: [] as { model: string, avgScore: number, count: number }[],
    recentTrend: [] as { date: string, score: number }[],
  })

  useEffect(() => {
    fetchLogs()
  }, [])

  // Fetch logs from the API
  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/reasoning-log')
      if (!response.ok) {
        throw new Error('Failed to fetch reasoning logs')
      }
      
      const data = await response.json()
      setLogs(data.logs)
      
      // Calculate stats
      calculateStats(data.logs)
    } catch (error) {
      console.error('Error fetching reasoning logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate statistics from logs
  const calculateStats = (logs: ReasoningLog[]) => {
    if (!logs.length) {
      setStats({
        totalTests: 0,
        averageScore: 0,
        modelPerformance: [],
        recentTrend: [],
      })
      return
    }

    // Total tests
    const totalTests = logs.length
    
    // Average score across all tests
    const averageScore = logs.reduce((acc, log) => acc + log.score, 0) / totalTests
    
    // Performance by model
    const modelGroups = logs.reduce((acc, log) => {
      const modelName = log.model
      if (!acc[modelName]) {
        acc[modelName] = { total: 0, count: 0 }
      }
      acc[modelName].total += log.score
      acc[modelName].count += 1
      return acc
    }, {} as Record<string, { total: number, count: number }>)
    
    const modelPerformance = Object.entries(modelGroups).map(([model, data]) => ({
      model,
      avgScore: data.total / data.count,
      count: data.count
    })).sort((a, b) => b.avgScore - a.avgScore)
    
    // Trend over time (last 10 days)
    const lastTenDays = new Date()
    lastTenDays.setDate(lastTenDays.getDate() - 10)
    
    const recentLogs = logs
      .filter(log => new Date(log.createdAt) >= lastTenDays)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    
    const dailyScores: Record<string, { total: number, count: number }> = {}
    
    recentLogs.forEach(log => {
      const date = new Date(log.createdAt).toLocaleDateString()
      if (!dailyScores[date]) {
        dailyScores[date] = { total: 0, count: 0 }
      }
      dailyScores[date].total += log.score
      dailyScores[date].count += 1
    })
    
    const recentTrend = Object.entries(dailyScores).map(([date, data]) => ({
      date,
      score: data.total / data.count
    }))
    
    setStats({
      totalTests,
      averageScore,
      modelPerformance,
      recentTrend,
    })
  }

  // Get filtered logs based on selected timeframe and model
  const getFilteredLogs = () => {
    let filtered = [...logs]
    
    // Apply timeframe filter
    if (timeframe === 'today') {
      const today = new Date().toDateString()
      filtered = filtered.filter(log => 
        new Date(log.createdAt).toDateString() === today
      )
    } else if (timeframe === 'week') {
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)
      filtered = filtered.filter(log => 
        new Date(log.createdAt) >= lastWeek
      )
    } else if (timeframe === 'month') {
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      filtered = filtered.filter(log => 
        new Date(log.createdAt) >= lastMonth
      )
    }
    
    // Apply model filter
    if (modelFilter !== 'all') {
      filtered = filtered.filter(log => 
        log.model.startsWith(modelFilter)
      )
    }
    
    return filtered
  }

  // Format the date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  // Format the model name for display
  const formatModelName = (modelName: string) => {
    if (modelName.includes(':')) {
      const [provider, model] = modelName.split(':')
      return <div>
        <Badge variant="outline" className="mr-2">{provider}</Badge>
        <span className="font-mono text-xs">{model}</span>
      </div>
    }
    return modelName
  }

  const filteredLogs = getFilteredLogs()

  return (
    <DashboardLayout
      pageTitle="Reasoning Analytics"
      pageDescription="Track and analyze AI reasoning model performance"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reasoning Analytics</h1>
          <p className="text-muted-foreground">
            Monitor reasoning performance across different models
          </p>
        </div>
        <Button
          onClick={fetchLogs}
          className="gap-2"
          variant="outline"
          disabled={isLoading}
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Reasoning Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalTests}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Average Reasoning Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.averageScore.toFixed(1)}/10
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Top Performing Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {stats.modelPerformance[0]?.model.split(':')[0] || 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground">
              {stats.modelPerformance[0]?.avgScore.toFixed(1) || 'N/A'}/10 ({stats.modelPerformance[0]?.count || 0} tests)
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        <Card className="col-span-3 md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Reasoning Test Logs</CardTitle>
              <div className="flex gap-2">
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 days</SelectItem>
                    <SelectItem value="month">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={modelFilter} onValueChange={setModelFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All models</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                    <SelectItem value="ollama">Ollama</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <p>Loading reasoning test data...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Brain className="h-16 w-16 mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">No reasoning test data available</p>
                <p className="text-xs text-muted-foreground">Generate UI components to collect reasoning data</p>
              </div>
            ) : (
              <ScrollArea className="h-[350px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Response Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{formatDate(log.createdAt)}</TableCell>
                        <TableCell>{formatModelName(log.model)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            log.score >= 8 ? "default" : 
                            log.score >= 5 ? "secondary" : 
                            "destructive"
                          }>
                            {log.score}/10
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.responseTime ? `${(log.responseTime / 1000).toFixed(2)}s` : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-3 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle>Model Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.modelPerformance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <BarChart className="h-12 w-12 mb-4 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">No comparison data available</p>
              </div>
            ) : (
              <ScrollArea className="h-[350px]">
                <div className="space-y-4">
                  {stats.modelPerformance.map((modelData) => (
                    <div key={modelData.model} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="font-medium text-sm">{modelData.model}</div>
                        <div className="text-sm font-medium">{modelData.avgScore.toFixed(1)}/10</div>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${(modelData.avgScore / 10) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        {modelData.count} tests
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
} 