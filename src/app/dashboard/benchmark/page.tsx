'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert } from '@/components/Alert';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  BarChart as BarChartIcon, 
  Clock, 
  Code, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Download,
  ExternalLink,
  Calendar,
  Award,
  Zap
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

import { 
  getBenchmarkResults, 
  getModelPreferenceMap, 
  runBenchmark,
  exportBenchmarkResults,
  archiveBenchmarkToNotion
} from '@/lib/benchmarkClient';

export default function BenchmarkDashboard() {
  const [benchmarkData, setBenchmarkData] = useState<any>(null);
  const [modelPreferences, setModelPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningBenchmark, setRunningBenchmark] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [archivingData, setArchivingData] = useState(false);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const results = await getBenchmarkResults();
        const preferences = await getModelPreferenceMap();
        setBenchmarkData(results);
        setModelPreferences(preferences);
      } catch (error) {
        console.error('Error loading benchmark data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Format bar chart data for response times
  const getResponseTimeData = () => {
    if (!benchmarkData) return [];
    
    const modelNames = Object.keys(benchmarkData.models || {});
    return Object.entries(benchmarkData.prompts || {}).map(([promptId, data]: [string, any]) => {
      const item: any = { promptId };
      
      modelNames.forEach(model => {
        if (data.results[model]) {
          item[model] = data.results[model].responseTime;
        }
      });
      
      return item;
    });
  };

  // Format bar chart data for code length
  const getCodeLengthData = () => {
    if (!benchmarkData) return [];
    
    const modelNames = Object.keys(benchmarkData.models || {});
    return Object.entries(benchmarkData.prompts || {}).map(([promptId, data]: [string, any]) => {
      const item: any = { promptId };
      
      modelNames.forEach(model => {
        if (data.results[model]) {
          item[model] = data.results[model].codeLength;
        }
      });
      
      return item;
    });
  };

  // Format line chart data for historical performance
  const getHistoricalData = () => {
    if (!benchmarkData?.history) return [];
    
    return benchmarkData.history.map((entry: any) => {
      const item: any = {
        date: format(parseISO(entry.timestamp), 'MM/dd'),
      };
      
      Object.entries(entry.models).forEach(([model, data]: [string, any]) => {
        item[`${model} Success`] = data.successRate;
        item[`${model} Time`] = data.avgResponseTime;
      });
      
      return item;
    }).reverse();
  };

  // Get all regressions for alerts
  const getAllRegressions = () => {
    if (!benchmarkData) return [];
    
    const regressions: any[] = [];
    
    Object.entries(benchmarkData.models || {}).forEach(([model, data]: [string, any]) => {
      if (data.regressions && data.regressions.length > 0) {
        data.regressions.forEach((regression: any) => {
          regressions.push({
            model,
            ...regression
          });
        });
      }
    });
    
    return regressions;
  };

  const handleRunBenchmark = async () => {
    setRunningBenchmark(true);
    try {
      await runBenchmark();
      // Reload data after benchmark completes
      const results = await getBenchmarkResults();
      const preferences = await getModelPreferenceMap();
      setBenchmarkData(results);
      setModelPreferences(preferences);
    } catch (error) {
      console.error('Error running benchmark:', error);
    } finally {
      setRunningBenchmark(false);
    }
  };

  const handleExportData = async () => {
    setExportingData(true);
    try {
      await exportBenchmarkResults('json');
      // You would normally handle the download here
    } catch (error) {
      console.error('Error exporting benchmark data:', error);
    } finally {
      setExportingData(false);
    }
  };

  const handleArchiveToNotion = async () => {
    setArchivingData(true);
    try {
      const result = await archiveBenchmarkToNotion();
      // Show a success message
      alert(`Successfully archived benchmark results to Notion${result.notionPageUrl ? `: ${result.notionPageUrl}` : '.'}`);
    } catch (error) {
      console.error('Error archiving to Notion:', error);
      alert(`Failed to archive to Notion: ${error.message}`);
    } finally {
      setArchivingData(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Loading benchmark results...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Model Benchmark Dashboard
          </h1>
          <p className="text-muted-foreground">
            Compare performance between different models and monitor learning behavior
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleRunBenchmark} 
            disabled={runningBenchmark}
            className="flex gap-2 items-center"
          >
            {runningBenchmark ? (
              <>
                <RefreshCw className="animate-spin h-4 w-4" />
                Running...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Run Benchmark
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExportData} 
            disabled={exportingData}
            className="flex gap-2 items-center"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button 
            variant="outline" 
            onClick={handleArchiveToNotion} 
            disabled={archivingData}
            className="flex gap-2 items-center"
          >
            <ExternalLink className="h-4 w-4" />
            Archive to Notion
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChartIcon className="h-5 w-5 text-primary" />
              Models Tested
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{benchmarkData?.summary?.totalModels || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {benchmarkData?.summary?.bestOverallModel && (
                <>Best overall: <span className="font-medium">{benchmarkData.summary.bestOverallModel}</span></>
              )}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              Prompts Evaluated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{benchmarkData?.summary?.totalPrompts || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Different component generation tasks
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Last Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {benchmarkData?.summary?.lastRunTimestamp
                ? format(new Date(benchmarkData.summary.lastRunTimestamp), 'MMM d, yyyy HH:mm')
                : 'Never'}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Via GitHub Actions workflow
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Regressions Alerts */}
      {getAllRegressions().length > 0 && (
        <div className="space-y-2">
          {getAllRegressions().map((regression, index) => (
            <Alert 
              key={index}
              variant="warning"
              title={`Regression detected in ${regression.model}`}
              description={
                regression.type === 'success'
                  ? `Model previously succeeded on prompt "${regression.prompt}" but now fails.`
                  : regression.type === 'responseTime'
                  ? `Response time increased from ${regression.previousValue}ms to ${regression.currentValue}ms on prompt "${regression.prompt}".`
                  : `Regression in ${regression.type} for prompt "${regression.prompt}".`
              }
              dismissible
            />
          ))}
        </div>
      )}

      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
          <TabsTrigger value="learning">Model Learning</TabsTrigger>
          <TabsTrigger value="history">Historical Data</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          {/* Response Time Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Response Time by Prompt</CardTitle>
              <CardDescription>Lower is better</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={getResponseTimeData()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="promptId" angle={-45} textAnchor="end" height={70} />
                    <YAxis label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }} />
                    <RechartsTooltip />
                    <Legend />
                    {benchmarkData && Object.keys(benchmarkData.models || {}).map((model, index) => (
                      <Bar 
                        key={model}
                        dataKey={model}
                        fill={
                          index === 0 ? '#3b82f6' : 
                          index === 1 ? '#10b981' : 
                          index === 2 ? '#6366f1' : 
                          '#f59e0b'
                        }
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Code Length Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Code Length by Prompt</CardTitle>
              <CardDescription>In characters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={getCodeLengthData()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="promptId" angle={-45} textAnchor="end" height={70} />
                    <YAxis label={{ value: 'Code Length (chars)', angle: -90, position: 'insideLeft' }} />
                    <RechartsTooltip />
                    <Legend />
                    {benchmarkData && Object.keys(benchmarkData.models || {}).map((model, index) => (
                      <Bar 
                        key={model}
                        dataKey={model}
                        fill={
                          index === 0 ? '#3b82f6' : 
                          index === 1 ? '#10b981' : 
                          index === 2 ? '#6366f1' : 
                          '#f59e0b'
                        }
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Success Rate Card */}
          <Card>
            <CardHeader>
              <CardTitle>Success Rate</CardTitle>
              <CardDescription>Percentage of successful completions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {benchmarkData && Object.entries(benchmarkData.models || {}).map(([model, data]: [string, any]) => (
                  <div key={model} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{model}</span>
                      <span className="font-medium">{data.successRate}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={data.successRate} className="h-2" />
                      <span className="text-xs text-muted-foreground">
                        {data.successCount}/{data.successCount + data.failCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Learning Map</CardTitle>
              <CardDescription>
                Which model performs best for each prompt type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {modelPreferences && Object.entries(modelPreferences).map(([promptId, data]: [string, any]) => (
                  <div key={promptId} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{promptId}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          <Award className="h-4 w-4 text-amber-500" />
                          <span className="font-semibold">{data.preferredModel}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {Math.round(data.confidence * 100)}% confidence
                          </span>
                        </div>
                      </div>
                      <div className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                        Learned
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <h4 className="text-sm font-medium mb-1">Reasons:</h4>
                      <ul className="text-sm list-disc pl-5 space-y-1">
                        {data.reasons.map((reason: string, i: number) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {/* Performance Over Time Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Over Time</CardTitle>
              <CardDescription>Success rate trend</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={getHistoricalData()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" orientation="left" label={{ value: 'Success Rate (%)', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Avg Response Time (ms)', angle: 90, position: 'insideRight' }} />
                    <RechartsTooltip />
                    <Legend />
                    
                    {benchmarkData && Object.keys(benchmarkData.models || {}).map((model, index) => [
                      <Line
                        key={`${model}-success`}
                        yAxisId="left"
                        type="monotone"
                        dataKey={`${model} Success`}
                        stroke={
                          index === 0 ? '#3b82f6' : 
                          index === 1 ? '#10b981' : 
                          '#6366f1'
                        }
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />,
                      <Line
                        key={`${model}-time`}
                        yAxisId="right"
                        type="monotone"
                        dataKey={`${model} Time`}
                        stroke={
                          index === 0 ? '#93c5fd' : 
                          index === 1 ? '#6ee7b7' : 
                          '#a5b4fc'
                        }
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ]).flat()}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 