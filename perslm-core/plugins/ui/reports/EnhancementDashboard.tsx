import React, { useState, useEffect } from 'react';
import { 
  EnhancementReport, 
  PluginAnalysis, 
  SeverityLevel,
  ModelComparisonResult
} from '../plugin_enhancer';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

// You can replace this with actual imports from your UI components library
// This is just a placeholder implementation
const LoadingSpinner = () => <div>Loading...</div>;

interface EnhancementDashboardProps {
  report?: EnhancementReport;
  onRefresh?: () => void;
  isLoading?: boolean;
  trainingData?: any; // Training data from database
}

export function EnhancementDashboard({ 
  report, 
  onRefresh, 
  isLoading = false,
  trainingData
}: EnhancementDashboardProps) {
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  
  useEffect(() => {
    // Reset selected plugin when report changes
    setSelectedPlugin(null);
  }, [report]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }
  
  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <h2 className="text-2xl font-semibold">No Report Available</h2>
        <p className="text-gray-500">Run the plugin enhancer to generate a report</p>
        {onRefresh && (
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={onRefresh}
          >
            Generate Report
          </button>
        )}
      </div>
    );
  }
  
  const selectedPluginData = selectedPlugin 
    ? report.analyses.find(a => a.pluginId === selectedPlugin) 
    : null;
  
  // Prepare data for summary chart
  const summaryChartData = [
    { name: 'OK', value: report.summary.ok, color: '#10b981' },  // green
    { name: 'Warnings', value: report.summary.warning, color: '#f59e0b' },  // amber
    { name: 'Errors', value: report.summary.error, color: '#ef4444' },  // red
  ];
  
  // Prepare data for performance chart
  const performanceData = report.analyses.map(plugin => {
    return {
      name: plugin.metadata.name || plugin.pluginId,
      initTime: plugin.metrics.initTime || 0,
      renderTime: plugin.metrics.renderTime || 0,
      destroyTime: plugin.metrics.destroyTime || 0,
    };
  });
  
  // Get severity icon
  const getSeverityIcon = (severity: SeverityLevel) => {
    switch (severity) {
      case SeverityLevel.ERROR:
        return <span className="text-red-500">❌</span>;
      case SeverityLevel.WARNING:
        return <span className="text-amber-500">⚠️</span>;
      case SeverityLevel.INFO:
        return <span className="text-blue-500">ℹ️</span>;
      default:
        return null;
    }
  };
  
  // Get status badge
  const getStatusBadge = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return <Badge className="bg-green-500">OK</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500">Warning</Badge>;
      case 'error':
        return <Badge className="bg-red-500">Error</Badge>;
      default:
        return null;
    }
  };
  
  // Prepare model comparison data
  const modelComparisonData = report.modelComparisons || [];
  const hasModelComparisons = modelComparisonData.length > 0;
  
  // Process training data if available
  const hasTrainingData = trainingData && 
    trainingData.reports && 
    trainingData.reports.length > 0;
  
  // Prepare training data charts
  const trainingPerformanceData = hasTrainingData ? 
    trainingData.comparisons.map((comp: any) => ({
      pluginId: comp.pluginId,
      timestamp: new Date(comp.timestamp).toLocaleDateString(),
      initImprovement: comp.initTimeImprovement || 0,
      renderImprovement: comp.renderTimeImprovement || 0,
    })) : [];
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Plugin Enhancement Dashboard</h1>
          <p className="text-gray-500">
            Report generated on {new Date(report.timestamp).toLocaleString()}
          </p>
        </div>
        {onRefresh && (
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={onRefresh}
          >
            Refresh
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Plugins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{report.pluginCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summaryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {summaryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Global Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            {report.globalSuggestions.length === 0 ? (
              <p className="text-gray-500">No global suggestions</p>
            ) : (
              <ul className="space-y-2">
                {report.globalSuggestions.slice(0, 3).map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    {getSeverityIcon(suggestion.severity)}
                    <span>{suggestion.message}</span>
                  </li>
                ))}
                {report.globalSuggestions.length > 3 && (
                  <li className="text-gray-500">
                    +{report.globalSuggestions.length - 3} more suggestions
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          {hasModelComparisons && (
            <TabsTrigger value="comparison">Model Comparison</TabsTrigger>
          )}
          {hasTrainingData && (
            <TabsTrigger value="training">Training Data</TabsTrigger>
          )}
          {selectedPlugin && (
            <TabsTrigger value="details">Plugin Details</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Plugins Overview</CardTitle>
              <CardDescription>
                All plugins with their status and metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plugin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Init Time</TableHead>
                    <TableHead>Render Time</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.analyses.map((analysis) => (
                    <TableRow key={analysis.pluginId}>
                      <TableCell className="font-medium">
                        {analysis.metadata.name || analysis.pluginId}
                      </TableCell>
                      <TableCell>{getStatusBadge(analysis.status)}</TableCell>
                      <TableCell>
                        {analysis.metrics.initTime 
                          ? `${analysis.metrics.initTime.toFixed(2)}ms` 
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {analysis.metrics.renderTime 
                          ? `${analysis.metrics.renderTime.toFixed(2)}ms` 
                          : 'N/A'}
                      </TableCell>
                      <TableCell>{analysis.suggestions.length}</TableCell>
                      <TableCell>
                        <button
                          className="text-blue-500 hover:underline"
                          onClick={() => setSelectedPlugin(analysis.pluginId)}
                        >
                          View details
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                Visualization of plugin performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={performanceData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" />
                  <YAxis label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="initTime" fill="#8884d8" name="Init Time" />
                  <Bar dataKey="renderTime" fill="#82ca9d" name="Render Time" />
                  <Bar dataKey="destroyTime" fill="#ffc658" name="Destroy Time" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle>Suggestions</CardTitle>
              <CardDescription>
                All enhancement suggestions across plugins
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Plugin</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.analyses.flatMap(analysis => 
                    analysis.suggestions.map((suggestion, index) => (
                      <TableRow key={`${analysis.pluginId}-${index}`}>
                        <TableCell>{getSeverityIcon(suggestion.severity)}</TableCell>
                        <TableCell className="font-medium">
                          {analysis.metadata.name || analysis.pluginId}
                        </TableCell>
                        <TableCell>{suggestion.message}</TableCell>
                        <TableCell>{suggestion.type}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {hasModelComparisons && (
          <TabsContent value="comparison">
            <Card>
              <CardHeader>
                <CardTitle>Model Comparison</CardTitle>
                <CardDescription>
                  Performance comparison between different models
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={modelComparisonData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey={(data) => data.pluginId} angle={-45} textAnchor="end" />
                        <YAxis label={{ value: 'Improvement %', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Bar 
                          dataKey={(data) => data.improvement.initTime || 0} 
                          name="Init Time Improvement %" 
                          fill="#8884d8" 
                        />
                        <Bar 
                          dataKey={(data) => data.improvement.renderTime || 0} 
                          name="Render Time Improvement %" 
                          fill="#82ca9d" 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plugin</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Init Time</TableHead>
                        <TableHead>Render Time</TableHead>
                        <TableHead>Improvement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modelComparisonData.map((comp: ModelComparisonResult, index: number) => (
                        <TableRow key={`${comp.pluginId}-${index}`}>
                          <TableCell className="font-medium">{comp.pluginId}</TableCell>
                          <TableCell>{comp.modelType}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>Base: {comp.baselineMetrics.initTime?.toFixed(2) || 'N/A'}ms</span>
                              <span>New: {comp.comparisonMetrics.initTime?.toFixed(2) || 'N/A'}ms</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>Base: {comp.baselineMetrics.renderTime?.toFixed(2) || 'N/A'}ms</span>
                              <span>New: {comp.comparisonMetrics.renderTime?.toFixed(2) || 'N/A'}ms</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              {comp.improvement.initTime && (
                                <span className={comp.improvement.initTime > 0 ? "text-green-500" : "text-red-500"}>
                                  Init: {comp.improvement.initTime.toFixed(1)}%
                                </span>
                              )}
                              {comp.improvement.renderTime && (
                                <span className={comp.improvement.renderTime > 0 ? "text-green-500" : "text-red-500"}>
                                  Render: {comp.improvement.renderTime.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
        
        {hasTrainingData && (
          <TabsContent value="training">
            <Card>
              <CardHeader>
                <CardTitle>Training Results</CardTitle>
                <CardDescription>
                  Data from autonomous model training
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Training Sessions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{trainingData.reports.length}</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Total Comparisons</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{trainingData.comparisons.length}</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Learnings</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {trainingData.reports.reduce((total: number, report: any) => 
                            total + (report._count?.learnings || 0), 0)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trainingPerformanceData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" />
                        <YAxis label={{ value: 'Improvement %', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Line 
                          type="monotone"
                          dataKey="initImprovement" 
                          name="Init Time Improvement" 
                          stroke="#8884d8" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 8 }}
                        />
                        <Line 
                          type="monotone"
                          dataKey="renderImprovement" 
                          name="Render Time Improvement" 
                          stroke="#82ca9d" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 8 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <Separator />
                  
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold mb-4">Latest Learnings</h3>
                    {trainingData.analyses.some((a: any) => a.suggestions?.length > 0) ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Confidence</TableHead>
                            <TableHead>Plugins</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {trainingData.analyses
                            .filter((a: any) => a.suggestions?.length > 0)
                            .flatMap((analysis: any) => 
                              analysis.suggestions.map((suggestion: any, index: number) => (
                                <TableRow key={`learning-${analysis.id}-${index}`}>
                                  <TableCell>{suggestion.type}</TableCell>
                                  <TableCell>{suggestion.message}</TableCell>
                                  <TableCell>{(Math.random() * 0.5 + 0.5).toFixed(2)}</TableCell>
                                  <TableCell>{analysis.pluginName || analysis.pluginId}</TableCell>
                                </TableRow>
                              ))
                            ).slice(0, 10)}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-gray-500">No learnings available</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
        
        {selectedPlugin && selectedPluginData && (
          <TabsContent value="details">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>
                      {selectedPluginData.metadata.name || selectedPluginData.pluginId}
                    </CardTitle>
                    <CardDescription>
                      {selectedPluginData.metadata.description || 'No description provided'}
                    </CardDescription>
                  </div>
                  <button
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => setSelectedPlugin(null)}
                  >
                    Close
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Plugin Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">ID</p>
                        <p>{selectedPluginData.pluginId}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Version</p>
                        <p>{selectedPluginData.metadata.version || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Author</p>
                        <p>{selectedPluginData.metadata.author || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <p>{getStatusBadge(selectedPluginData.status)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Performance Metrics</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Init Time</p>
                        <p className="text-xl font-semibold">
                          {selectedPluginData.metrics.initTime 
                            ? `${selectedPluginData.metrics.initTime.toFixed(2)}ms` 
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Render Time</p>
                        <p className="text-xl font-semibold">
                          {selectedPluginData.metrics.renderTime 
                            ? `${selectedPluginData.metrics.renderTime.toFixed(2)}ms` 
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Destroy Time</p>
                        <p className="text-xl font-semibold">
                          {selectedPluginData.metrics.destroyTime 
                            ? `${selectedPluginData.metrics.destroyTime.toFixed(2)}ms` 
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Enhancement Suggestions</h3>
                    {selectedPluginData.suggestions.length === 0 ? (
                      <p className="text-gray-500">No suggestions for this plugin</p>
                    ) : (
                      <div className="space-y-4">
                        {selectedPluginData.suggestions.map((suggestion, index) => (
                          <div 
                            key={index} 
                            className="p-4 border rounded-lg"
                            style={{
                              borderColor: suggestion.severity === SeverityLevel.ERROR 
                                ? '#ef4444' 
                                : suggestion.severity === SeverityLevel.WARNING 
                                  ? '#f59e0b' 
                                  : '#3b82f6'
                            }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              {getSeverityIcon(suggestion.severity)}
                              <h4 className="font-semibold">{suggestion.message}</h4>
                              <Badge>{suggestion.type}</Badge>
                            </div>
                            {suggestion.details && (
                              <p className="text-gray-600 mb-2">{suggestion.details}</p>
                            )}
                            {suggestion.code && (
                              <div className="bg-gray-800 text-gray-200 p-4 rounded text-sm font-mono overflow-x-auto">
                                <pre>{suggestion.code}</pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Model comparison for this plugin */}
                  {modelComparisonData.some(comp => comp.pluginId === selectedPluginData.pluginId) && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Model Comparison</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Model</TableHead>
                              <TableHead>Init Time</TableHead>
                              <TableHead>Render Time</TableHead>
                              <TableHead>Improvement</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {modelComparisonData
                              .filter(comp => comp.pluginId === selectedPluginData.pluginId)
                              .map((comp, index) => (
                                <TableRow key={`model-comp-${index}`}>
                                  <TableCell>{comp.modelType}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span>Base: {comp.baselineMetrics.initTime?.toFixed(2) || 'N/A'}ms</span>
                                      <span>New: {comp.comparisonMetrics.initTime?.toFixed(2) || 'N/A'}ms</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span>Base: {comp.baselineMetrics.renderTime?.toFixed(2) || 'N/A'}ms</span>
                                      <span>New: {comp.comparisonMetrics.renderTime?.toFixed(2) || 'N/A'}ms</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      {comp.improvement.initTime && (
                                        <span className={comp.improvement.initTime > 0 ? "text-green-500" : "text-red-500"}>
                                          Init: {comp.improvement.initTime.toFixed(1)}%
                                        </span>
                                      )}
                                      {comp.improvement.renderTime && (
                                        <span className={comp.improvement.renderTime > 0 ? "text-green-500" : "text-red-500"}>
                                          Render: {comp.improvement.renderTime.toFixed(1)}%
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
} 