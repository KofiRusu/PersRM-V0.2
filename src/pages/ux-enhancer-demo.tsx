import React, { useState, useEffect } from 'react';
import { UXDashboard } from '../components/UXDashboard';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import { Settings, Info, BarChart2 } from 'lucide-react';
import { UXEnhancerEngine } from '../lib/hooks/useUXEnhancer';

// Mock UX Enhancer Engine for demo purposes
class MockUXEnhancerEngine implements UXEnhancerEngine {
  private progressCallbacks: ((progress: number) => void)[] = [];
  private completeCallbacks: ((result: any) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private analyzing = false;
  private analysisTimer: NodeJS.Timeout | null = null;

  async analyze(options?: any): Promise<void> {
    if (this.analyzing) return;
    
    this.analyzing = true;
    let progress = 0;
    
    // Clear any existing timer
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
    }
    
    // Simulate progressive analysis
    this.analysisTimer = setInterval(() => {
      progress += 5;
      this.progressCallbacks.forEach(cb => cb(progress));
      
      if (progress >= 100) {
        clearInterval(this.analysisTimer!);
        this.analyzing = false;
        
        // Generate mock results
        const result = this.generateMockResults(options);
        this.completeCallbacks.forEach(cb => cb(result));
      }
    }, 300);
  }

  onProgress(callback: (progress: number) => void): () => void {
    this.progressCallbacks.push(callback);
    return () => {
      this.progressCallbacks = this.progressCallbacks.filter(cb => cb !== callback);
    };
  }

  onComplete(callback: (result: any) => void): () => void {
    this.completeCallbacks.push(callback);
    return () => {
      this.completeCallbacks = this.completeCallbacks.filter(cb => cb !== callback);
    };
  }

  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      this.errorCallbacks = this.errorCallbacks.filter(cb => cb !== callback);
    };
  }

  async generateReport(path?: string): Promise<string> {
    return `/mock-reports/${Date.now()}-report.json`;
  }

  isAnalyzing(): boolean {
    return this.analyzing;
  }

  private generateMockResults(options?: any): any {
    // Example severity distribution
    const severityLevels = ['Critical', 'High', 'Medium', 'Low'];
    
    // Generate random number of issues with different severities
    const generateIssues = (count: number, phaseId: string) => {
      return Array.from({ length: count }).map((_, index) => ({
        id: `${phaseId}-issue-${index}`,
        phaseId,
        title: `${severityLevels[Math.floor(Math.random() * severityLevels.length)]} Issue ${index + 1}`,
        description: `This is a sample issue description for the ${phaseId} phase.`,
        severity: severityLevels[Math.floor(Math.random() * severityLevels.length)],
        suggestions: [
          `Suggestion 1: Consider implementing better error handling`,
          `Suggestion 2: Optimize rendering to improve performance`
        ]
      }));
    };
    
    // Generate mock phase results
    const generatePhase = (name: string, description: string, score: number, maxScore: number) => {
      const issues = generateIssues(Math.floor(Math.random() * 5) + 1, name);
      return {
        name,
        description,
        score,
        maxScore,
        duration: Math.floor(Math.random() * 2000) + 500,
        issues
      };
    };

    // Calculate a random score, ensuring it's less than or equal to maxScore
    const getRandomScore = (maxScore: number) => Math.floor(Math.random() * (maxScore + 1));

    // Mock phases with scores
    const phases = {
      initialization: generatePhase(
        'Initialization', 
        'Application startup and resource loading', 
        getRandomScore(20), 
        20
      ),
      rendering: generatePhase(
        'Rendering', 
        'UI components rendering performance', 
        getRandomScore(25), 
        25
      ),
      interaction: generatePhase(
        'User Interaction', 
        'Response time to user actions', 
        getRandomScore(30), 
        30
      ),
      accessibility: generatePhase(
        'Accessibility', 
        'Compliance with accessibility standards', 
        getRandomScore(15), 
        15
      ),
      performance: generatePhase(
        'Overall Performance', 
        'Core performance metrics assessment', 
        getRandomScore(10), 
        10
      )
    };
    
    // Calculate total score and issues
    let overallScore = 0;
    let maxScore = 0;
    let totalIssues = 0;
    
    Object.values(phases).forEach(phase => {
      overallScore += phase.score;
      maxScore += phase.maxScore;
      totalIssues += phase.issues.length;
    });
    
    return {
      appName: 'Demo Application',
      overallScore,
      maxScore,
      timestamp: new Date().toISOString(),
      duration: Math.floor(Math.random() * 5000) + 3000,
      totalIssues,
      phases
    };
  }
}

export default function UXEnhancerDemo() {
  const [engine] = useState<UXEnhancerEngine>(() => new MockUXEnhancerEngine());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60000);
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="container mx-auto py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">UX Enhancer Demo</h1>
        <p className="text-muted-foreground">
          Experience how the UX Enhancer can help improve your application
        </p>
        <Separator className="my-6" />
      </header>

      <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="about" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              About
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="space-y-6">
          <UXDashboard 
            engine={engine} 
            autoRefresh={autoRefresh} 
            refreshInterval={refreshInterval} 
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Settings</CardTitle>
              <CardDescription>
                Configure how the UX Enhancer operates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="auto-refresh">Auto Refresh</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      id="auto-refresh"
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="auto-refresh">Enable automatic refresh</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically re-run analysis at the specified interval
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="refresh-interval">Refresh Interval (ms)</Label>
                  <Input
                    id="refresh-interval"
                    type="number"
                    min="5000"
                    step="1000"
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                    disabled={!autoRefresh}
                  />
                  <p className="text-sm text-muted-foreground">
                    How often to refresh the analysis (minimum 5 seconds)
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="custom-config">Custom Configuration</Label>
                <Textarea
                  id="custom-config"
                  placeholder='{
  "analysisDepth": "detailed",
  "includeBrowserMetrics": true,
  "targetScore": 85
}'
                  className="font-mono h-32"
                />
                <p className="text-sm text-muted-foreground">
                  Optional: Provide a JSON configuration to customize the analysis
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => {
                  setActiveTab('dashboard');
                  engine.analyze({});
                }}
              >
                Apply Settings & Run Analysis
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>About UX Enhancer</CardTitle>
              <CardDescription>
                Understanding how the UX Enhancer can improve your application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose max-w-none dark:prose-invert">
                <h3>What is the UX Enhancer?</h3>
                <p>
                  The UX Enhancer is a powerful tool designed to analyze and improve your application's
                  user experience. It provides real-time metrics, identifies issues, and offers concrete
                  suggestions for enhancement.
                </p>

                <h3>Key Features</h3>
                <ul>
                  <li>
                    <strong>Multi-phase Analysis</strong>: Examines different aspects of your application's UX
                  </li>
                  <li>
                    <strong>Real-time Feedback</strong>: Provides immediate insights during development
                  </li>
                  <li>
                    <strong>Actionable Suggestions</strong>: Specific recommendations to improve UX
                  </li>
                  <li>
                    <strong>Comprehensive Reporting</strong>: Detailed reports for tracking progress
                  </li>
                </ul>

                <h3>How to Use</h3>
                <p>
                  This demo showcases a mock implementation of the UX Enhancer. In a real application:
                </p>
                <ol>
                  <li>Integrate the UX Enhancer into your development workflow</li>
                  <li>Run regular analyses to track UX improvements</li>
                  <li>Review suggestions and implement changes</li>
                  <li>Use the dashboard to monitor progress over time</li>
                </ol>

                <div className="bg-muted p-4 rounded-md">
                  <h4 className="text-sm font-medium">Note</h4>
                  <p className="text-sm">
                    This is a demonstration using mock data. In a real implementation, 
                    the UX Enhancer would analyze your actual application code and runtime performance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 