'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  version: number;
  createdAt: string;
}

interface PromptExecution {
  id: string;
  promptTemplateId: string;
  input: Record<string, any>;
  output: string;
  success: boolean | null;
  feedback: string | null;
  feedbackDetails: string | null;
  executionTime: number;
  executedAt: string;
  template: PromptTemplate;
}

interface PromptExecutionsResponse {
  executions: PromptExecution[];
  count: number;
}

interface PromptTemplateMetrics {
  templateId: string;
  templateName: string;
  category: string;
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number; // in ms
  feedbackCounts: {
    positive: number;
    neutral: number;
    negative: number;
    none: number;
  };
}

const PromptsDashboard = () => {
  const [executions, setExecutions] = useState<PromptExecution[]>([]);
  const [metrics, setMetrics] = useState<PromptTemplateMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Fetch executions data
  useEffect(() => {
    const fetchExecutions = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/logging/prompt-executions?limit=500');
        if (!res.ok) {
          throw new Error('Failed to fetch prompt executions');
        }

        const data: PromptExecutionsResponse = await res.json();
        setExecutions(data.executions);

        // Extract unique categories
        const uniqueCategories = Array.from(
          new Set(data.executions.map(e => e.template.category))
        );
        setCategories(['all', ...uniqueCategories]);

        // Process the data
        processExecutionsData(data.executions);
      } catch (err) {
        console.error('Error fetching prompt executions:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchExecutions();
  }, []);

  // Process executions data to calculate metrics
  const processExecutionsData = (executionsData: PromptExecution[]) => {
    // Group executions by template
    const templateMap = new Map<string, PromptExecution[]>();
    
    executionsData.forEach(execution => {
      if (!templateMap.has(execution.promptTemplateId)) {
        templateMap.set(execution.promptTemplateId, []);
      }
      templateMap.get(execution.promptTemplateId)!.push(execution);
    });
    
    // Calculate metrics for each template
    const templateMetrics: PromptTemplateMetrics[] = [];
    
    templateMap.forEach((templateExecutions, templateId) => {
      // Template information
      const template = templateExecutions[0].template;
      
      // Count successful executions
      const successfulExecutions = templateExecutions.filter(e => e.success === true);
      const executionsWithFeedback = templateExecutions.filter(e => e.feedback !== null);
      
      // Calculate success rate
      const successRate = executionsWithFeedback.length > 0
        ? successfulExecutions.length / executionsWithFeedback.length
        : 0;
      
      // Count by feedback type
      const feedbackCounts = {
        positive: templateExecutions.filter(e => e.feedback === 'positive').length,
        neutral: templateExecutions.filter(e => e.feedback === 'neutral').length,
        negative: templateExecutions.filter(e => e.feedback === 'negative').length,
        none: templateExecutions.filter(e => e.feedback === null).length,
      };
      
      // Calculate average execution time
      const totalExecutionTime = templateExecutions.reduce((sum, e) => sum + e.executionTime, 0);
      const averageExecutionTime = templateExecutions.length > 0
        ? totalExecutionTime / templateExecutions.length
        : 0;
      
      // Add metrics
      templateMetrics.push({
        templateId,
        templateName: template.name,
        category: template.category,
        totalExecutions: templateExecutions.length,
        successRate,
        averageExecutionTime,
        feedbackCounts,
      });
    });
    
    // Sort by total executions (descending)
    templateMetrics.sort((a, b) => b.totalExecutions - a.totalExecutions);
    
    setMetrics(templateMetrics);
  };

  // Filter metrics by selected category
  const filteredMetrics = selectedCategory === 'all'
    ? metrics
    : metrics.filter(m => m.category === selectedCategory);

  // Prepare data for charts
  const successRateData = filteredMetrics.map(m => ({
    name: m.templateName,
    successRate: Math.round(m.successRate * 100),
    executions: m.totalExecutions,
  }));

  const executionTimeData = filteredMetrics.map(m => ({
    name: m.templateName,
    executionTime: Math.round(m.averageExecutionTime),
    executions: m.totalExecutions,
  }));

  // Calculate aggregated feedback counts
  const totalFeedbackCounts = filteredMetrics.reduce(
    (acc, m) => {
      acc.positive += m.feedbackCounts.positive;
      acc.neutral += m.feedbackCounts.neutral;
      acc.negative += m.feedbackCounts.negative;
      acc.none += m.feedbackCounts.none;
      return acc;
    },
    { positive: 0, neutral: 0, negative: 0, none: 0 }
  );

  const feedbackPieData = [
    { name: 'Positive', value: totalFeedbackCounts.positive },
    { name: 'Neutral', value: totalFeedbackCounts.neutral },
    { name: 'Negative', value: totalFeedbackCounts.negative },
    { name: 'No feedback', value: totalFeedbackCounts.none },
  ];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Prompt Performance Dashboard</h1>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="bg-destructive/20 text-destructive p-4 rounded-md">
          Error: {error}
        </div>
      ) : (
        <>
          {/* Category Filter */}
          <div className="mb-6">
            <Tabs 
              defaultValue="all" 
              className="w-full" 
              onValueChange={value => setSelectedCategory(value)}
            >
              <TabsList className="grid w-full max-w-md grid-cols-4">
                {categories.map(category => (
                  <TabsTrigger key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Stats Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredMetrics.length}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredMetrics.reduce((sum, m) => sum + m.totalExecutions, 0)}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredMetrics.length > 0
                    ? Math.round(
                        filteredMetrics.reduce((sum, m) => sum + m.successRate, 0) /
                          filteredMetrics.length *
                          100
                      )
                    : 0}%
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredMetrics.length > 0
                    ? Math.round(
                        filteredMetrics.reduce((sum, m) => sum + m.averageExecutionTime, 0) /
                          filteredMetrics.length
                      )
                    : 0}ms
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Success Rate Chart */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Success Rates by Template</CardTitle>
                <CardDescription>Percentage of successful prompt executions</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={successRateData.slice(0, 10)} // Top 10 templates by execution count
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} unit="%" />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Success Rate']} />
                    <Bar dataKey="successRate" fill="#8884d8">
                      {successRateData.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Feedback Distribution */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Feedback Distribution</CardTitle>
                <CardDescription>Breakdown of user feedback on prompts</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={feedbackPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {feedbackPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Count']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Template List */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Prompt Templates</CardTitle>
              <CardDescription>Performance metrics for all templates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Template Name</th>
                      <th className="text-left py-3 px-4">Category</th>
                      <th className="text-right py-3 px-4">Executions</th>
                      <th className="text-right py-3 px-4">Success Rate</th>
                      <th className="text-right py-3 px-4">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMetrics.map(metric => (
                      <tr key={metric.templateId} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">{metric.templateName}</td>
                        <td className="py-3 px-4">{metric.category}</td>
                        <td className="text-right py-3 px-4">{metric.totalExecutions}</td>
                        <td className="text-right py-3 px-4">
                          {Math.round(metric.successRate * 100)}%
                        </td>
                        <td className="text-right py-3 px-4">
                          {Math.round(metric.averageExecutionTime)}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default PromptsDashboard; 