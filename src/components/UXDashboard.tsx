import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  CardContent,
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Check, AlertTriangle, Download, Info, Loader2, Brain, TrendingUp, Activity, UserX, Lightbulb } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  ChartData,
} from 'chart.js';
import { UXEnhancerEngine } from '@/lib/ux-enhancer/UXEnhancerEngine';
import { PhaseResult, UXEnhancementSummary } from '@/lib/ux-enhancer/types';
import { useUXEnhancerEvents } from '@/hooks/useUXEnhancerEvents';
import { ReportGenerator } from '@/lib/report/ReportGenerator';
import { useUXEnhancer } from '@/lib/ux-enhancer/useUXEnhancer';
import { 
  EnhancementSummary, 
  PhaseType, 
  SeverityLevel, 
  Issue,
  ReportConfig,
  DEFAULT_REPORT_CONFIG
} from '@/lib/ux-enhancer/types';
import { AlertTriangle as AlertTriangleIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { ExternalLink } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { ArcElement } from 'chart.js';
import { validateEnhancementSummary } from '../lib/ux-enhancer/validation';
import { 
  BarChart, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer 
} from 'recharts';
import { RefreshCw, XCircle } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { Radar } from 'react-chartjs-2';
import { 
  UXEnhancementSummary, 
  UXIssue, 
  PhaseScore, 
  PhaseType,
  SeverityLevel
} from '../lib/persrm/types';
import { getCurrentModeString } from '../lib/persrm/agent-switcher';
import { getBenchmarkHistory, EnhancedBenchmarkEntry, getBenchmarkTrend } from '../lib/analytics/benchmark';
import { 
  SimulatedFlowResult, 
  UserFlow, 
  FlowStep,
  generateSampleUserFlows, 
  simulateUserFlow 
} from '../lib/feedback/simulator';
import { 
  ComponentLearningData, 
  LearnerSuggestion,
  getAllComponentData,
  getStagnantComponents 
} from '../lib/feedback/learner';
import { getNotionConfig } from '../lib/integrations/notion-sync';
import { getSlackConfig } from '../lib/integrations/slack-sync';
import { sendUXAnalysisToNotion } from '../lib/integrations/notion-sync';
import { sendUXAnalysisToSlack } from '../lib/integrations/slack-sync';
import { sendRegressionAlertToSlack } from '../lib/integrations/slack-sync';
import { sendAIInsightsToSlack } from '../lib/integrations/slack-sync';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler
);

interface UXDashboardProps {
  websocketUrl?: string;
  pollInterval?: number; // alternative to websocket - poll every n milliseconds
  initialData?: UXEnhancementSummary;
  showHistory?: boolean;
  showFeedback?: boolean;
  showIntegrations?: boolean;
}

// Mock data for initial state
const initialSummary: UXEnhancementSummary = {
  id: 'initial',
  appName: 'Loading...',
  version: '0.0.0',
  componentName: '',
  timestamp: new Date().toISOString(),
  duration: 0,
  overallScore: 0,
  maxScore: 100,
  phases: [],
  issues: []
};

// Color mapping for severity levels
const severityColors = {
  [SeverityLevel.CRITICAL]: '#f44336', // red
  [SeverityLevel.ERROR]: '#ff9800',    // orange
  [SeverityLevel.WARNING]: '#ffeb3b',  // yellow
  [SeverityLevel.INFO]: '#2196f3'      // blue
};

// Color mapping for phase types
const phaseColors = {
  [PhaseType.LOAD_TIME]: '#4caf50',
  [PhaseType.RESPONSIVENESS]: '#2196f3',
  [PhaseType.ACCESSIBILITY]: '#9c27b0',
  [PhaseType.VISUAL_CONSISTENCY]: '#ff9800',
  [PhaseType.ANIMATIONS]: '#f44336',
  [PhaseType.DESIGN_TOKENS]: '#009688'
};

const UXDashboard: React.FC<UXDashboardProps> = ({
  websocketUrl,
  pollInterval = 0,
  initialData,
  showHistory = false,
  showFeedback = false,
  showIntegrations = false
}) => {
  // State for the current analysis results
  const [summary, setSummary] = useState<UXEnhancementSummary>(initialData || initialSummary);
  
  // State for historical data
  const [history, setHistory] = useState<UXEnhancementSummary[]>([]);
  
  // State for benchmark data
  const [benchmarkHistory, setBenchmarkHistory] = useState<EnhancedBenchmarkEntry[]>([]);
  
  // State for the active phase tab
  const [activePhase, setActivePhase] = useState<string>('all');
  
  // State for active tab
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'integrations'>('current');
  
  // State for websocket connection
  const [connected, setConnected] = useState<boolean>(false);
  
  // State for current mode
  const [currentMode, setCurrentMode] = useState<string>('mock');
  
  // State for trend chart data
  const [trendData, setTrendData] = useState<ChartData<'line'>>({
    labels: [],
    datasets: [
      {
        label: 'Overall Score',
        data: [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1
      }
    ]
  });
  
  // Feedback tab state
  const [userFlows, setUserFlows] = useState<UserFlow[]>([]);
  const [flowResults, setFlowResults] = useState<SimulatedFlowResult[]>([]);
  const [runningSimulation, setRunningSimulation] = useState<boolean>(false);
  const [learningData, setLearningData] = useState<ComponentLearningData[]>([]);
  const [stagnantComponents, setStagnantComponents] = useState<ComponentLearningData[]>([]);
  const [activeFeedbackSection, setActiveFeedbackSection] = useState<'flows' | 'learning' | 'suggestions'>('flows');
  
  // Integration state
  const [notionConfig, setNotionConfig] = useState<{ enabled: boolean, configured: boolean }>({ enabled: false, configured: false });
  const [slackConfig, setSlackConfig] = useState<{ enabled: boolean, configured: boolean }>({ enabled: false, configured: false });
  const [integrationStatus, setIntegrationStatus] = useState<{ notion: string; slack: string }>({ notion: '', slack: '' });
  const [showConfirmation, setShowConfirmation] = useState<{show: boolean, type: string, message: string}>({show: false, type: '', message: ''});
  const [isSending, setIsSending] = useState<{notion: boolean, slack: boolean, regression: boolean, insights: boolean}>({
    notion: false, 
    slack: false,
    regression: false,
    insights: false
  });
  
  // Connection and data loading
  useEffect(() => {
    let socket: WebSocket | null = null;
    let pollTimer: NodeJS.Timeout | null = null;
    
    // Function to fetch data via API
    const fetchData = async () => {
      try {
        const response = await fetch('/api/persrm/latest');
        if (response.ok) {
          const data = await response.json();
          setSummary(data);
          
          // Add to history if we're showing history
          if (showHistory) {
            setHistory(prev => {
              // Only add if it's a new report (different ID)
              if (prev.find(item => item.id === data.id)) {
                return prev;
              }
              return [...prev, data].sort((a, b) => 
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              ).slice(0, 10); // Keep last 10 reports
            });
          }
        }
      } catch (error) {
        console.error('Error fetching UX data:', error);
      }
    };
    
    // Function to fetch benchmark history
    const fetchBenchmarkHistory = useCallback(async () => {
      if (!showHistory) return;
      
      try {
        // Get the most recent benchmark entries
        const history = getBenchmarkHistory(10);
        setBenchmarkHistory(history);
        
        // Get trend data for chart
        const trend = getBenchmarkTrend(20);
        
        // Format dates for chart labels
        const labels = trend.timestamps.map(ts => {
          const date = new Date(ts);
          return date.toLocaleDateString();
        });
        
        // Update chart data
        setTrendData({
          labels,
          datasets: [
            {
              label: 'Overall Score',
              data: trend.scores,
              borderColor: 'rgb(75, 192, 192)',
              backgroundColor: 'rgba(75, 192, 192, 0.5)',
              tension: 0.1
            }
          ]
        });
      } catch (error) {
        console.error('Error fetching benchmark history:', error);
      }
    }, [showHistory]);
    
    // Function to load feedback data
    const loadFeedbackData = async () => {
      if (!showFeedback) return;
      
      try {
        // Load user flows (in a real app, this would be from an API)
        const flows = generateSampleUserFlows();
        setUserFlows(flows);
        
        // Load learning data
        const learningData = getAllComponentData();
        setLearningData(learningData);
        
        // Get stagnant components
        const stagnantComps = getStagnantComponents(3);
        setStagnantComponents(stagnantComps);
      } catch (error) {
        console.error('Error loading feedback data:', error);
      }
    };
    
    // Set up websocket or polling
    if (websocketUrl) {
      // Use WebSocket
      socket = new WebSocket(websocketUrl);
      
      socket.onopen = () => {
        console.log('Connected to UX analysis websocket');
        setConnected(true);
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setSummary(data);
          
          // Add to history if we're showing history
          if (showHistory) {
            setHistory(prev => {
              // Only add if it's a new report (different ID)
              if (prev.find(item => item.id === data.id)) {
                return prev;
              }
              return [...prev, data].sort((a, b) => 
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              ).slice(0, 10); // Keep last 10 reports
            });
          }
        } catch (error) {
          console.error('Error parsing websocket data:', error);
        }
      };
      
      socket.onclose = () => {
        console.log('Disconnected from UX analysis websocket');
        setConnected(false);
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };
    } else if (pollInterval > 0) {
      // Use polling
      fetchData(); // Initial fetch
      
      pollTimer = setInterval(fetchData, pollInterval);
    } else {
      // One-time fetch
      fetchData();
    }
    
    // Get benchmark history for the history tab
    if (showHistory) {
      fetchBenchmarkHistory();
    }
    
    // Load feedback data if needed
    if (showFeedback) {
      loadFeedbackData();
    }
    
    // Get the current mode from environment
    setCurrentMode(getCurrentModeString());
    
    // Cleanup
    return () => {
      if (socket) {
        socket.close();
      }
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [websocketUrl, pollInterval, showHistory, showFeedback, initialData]);
  
  // Run user flow simulation
  const runSimulation = async (flow: UserFlow) => {
    setRunningSimulation(true);
    
    try {
      // Create component map from current summary
      const componentMap = {
        [summary.componentName || 'Default']: summary
      };
      
      // For sample data, add some mock components that match our flow
      flow.steps.forEach(step => {
        if (!componentMap[step.component]) {
          componentMap[step.component] = {
            ...summary,
            id: `mock-${step.component}`,
            componentName: step.component,
            overallScore: Math.random() * 70 + 30, // Random score between 30-100
            maxScore: 100,
            issues: []
          };
        }
      });
      
      // Run the simulation
      const results = simulateUserFlow(flow, componentMap, {
        iterations: 10,
        noiseLevel: 0.3
      });
      
      setFlowResults(results);
    } catch (error) {
      console.error('Error running simulation:', error);
    } finally {
      setRunningSimulation(false);
    }
  };
  
  // Filter issues based on active phase
  const filteredIssues = activePhase === 'all' 
    ? summary.issues 
    : summary.issues.filter(issue => issue.phase === activePhase);
  
  // Calculate counts by severity
  const issueCounts = {
    critical: summary.issues.filter(i => i.severity === SeverityLevel.CRITICAL).length,
    error: summary.issues.filter(i => i.severity === SeverityLevel.ERROR).length,
    warning: summary.issues.filter(i => i.severity === SeverityLevel.WARNING).length,
    info: summary.issues.filter(i => i.severity === SeverityLevel.INFO).length,
  };
  
  // Get score color based on value
  const getScoreColor = (score: number, max: number) => {
    const percentage = (score / max) * 100;
    if (percentage >= 90) return '#4caf50'; // green
    if (percentage >= 70) return '#8bc34a'; // light green
    if (percentage >= 50) return '#ffc107'; // amber
    if (percentage >= 30) return '#ff9800'; // orange
    return '#f44336'; // red
  };
  
  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };
  
  // Format delta value with +/- sign and color
  const formatDelta = (value: number) => {
    if (value === 0) return null;
    
    const color = value > 0 ? '#4caf50' : '#f44336';
    const sign = value > 0 ? '+' : '';
    
    return (
      <span style={{ color, marginLeft: '8px' }}>
        {sign}{value.toFixed(1)}
      </span>
    );
  };
  
  // Get success rate color
  const getSuccessColor = (rate: number) => {
    if (rate >= 80) return '#4caf50'; // green
    if (rate >= 60) return '#8bc34a'; // light green
    if (rate >= 40) return '#ffc107'; // amber
    if (rate >= 20) return '#ff9800'; // orange
    return '#f44336'; // red
  };
  
  // Get confusion rate color (lower is better)
  const getConfusionColor = (rate: number) => {
    if (rate <= 10) return '#4caf50'; // green
    if (rate <= 25) return '#8bc34a'; // light green
    if (rate <= 40) return '#ffc107'; // amber
    if (rate <= 60) return '#ff9800'; // orange
    return '#f44336'; // red
  };
  
  // Get improvement rate color
  const getImprovementColor = (rate: number) => {
    if (rate >= 60) return '#4caf50'; // green
    if (rate >= 40) return '#8bc34a'; // light green
    if (rate >= 20) return '#ffc107'; // amber
    if (rate >= 10) return '#ff9800'; // orange
    return '#f44336'; // red
  };
  
  // Load integration configurations
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const notionCfg = await getNotionConfig();
        setNotionConfig({
          enabled: notionCfg?.enabled || false,
          configured: !!(notionCfg?.apiKey && notionCfg?.databaseId)
        });
        
        const slackCfg = await getSlackConfig();
        setSlackConfig({
          enabled: slackCfg?.enabled || false,
          configured: !!slackCfg?.webhookUrl
        });
      } catch (error) {
        console.error('Failed to load integration configs:', error);
      }
    };
    
    if (showIntegrations) {
      loadConfigs();
    }
  }, [showIntegrations]);

  // Function to send test analysis to Notion
  const sendTestToNotion = async () => {
    if (!summary) return;
    
    setShowConfirmation({
      show: true,
      type: 'notion',
      message: 'Send this UX analysis to Notion?'
    });
  };

  // Function to send test analysis to Slack
  const sendTestToSlack = async () => {
    if (!summary) return;
    
    setShowConfirmation({
      show: true,
      type: 'slack',
      message: 'Send this UX analysis to Slack?'
    });
  };

  // Function to send test regression alert to Slack
  const sendTestRegressionToSlack = async () => {
    if (!summary) return;
    
    setShowConfirmation({
      show: true,
      type: 'regression',
      message: 'Send a test regression alert to Slack?'
    });
  };

  // Function to send test AI insights to Slack
  const sendTestInsightsToSlack = async () => {
    if (!summary) return;
    
    setShowConfirmation({
      show: true,
      type: 'insights',
      message: 'Send test AI insights to Slack?'
    });
  };

  // Handle confirmation response
  const handleConfirmation = async (confirmed: boolean) => {
    if (!confirmed) {
      setShowConfirmation({show: false, type: '', message: ''});
      return;
    }
    
    const type = showConfirmation.type;
    setShowConfirmation({show: false, type: '', message: ''});
    
    if (type === 'notion') {
      await handleSendToNotion();
    } else if (type === 'slack') {
      await handleSendToSlack();
    } else if (type === 'regression') {
      await handleSendRegressionAlert();
    } else if (type === 'insights') {
      await handleSendInsights();
    }
  };

  // Handle send to Notion
  const handleSendToNotion = async () => {
    if (!summary) return;
    
    setIsSending({...isSending, notion: true});
    setIntegrationStatus({...integrationStatus, notion: 'Sending to Notion...'});
    
    try {
      const success = await sendUXAnalysisToNotion(summary);
      
      if (success) {
        setIntegrationStatus({...integrationStatus, notion: 'Successfully sent to Notion!'});
        setTimeout(() => {
          setIntegrationStatus({...integrationStatus, notion: ''});
        }, 5000);
      } else {
        setIntegrationStatus({...integrationStatus, notion: 'Failed to send to Notion'});
      }
    } catch (error) {
      setIntegrationStatus({...integrationStatus, notion: `Error: ${error.message}`});
    }
    
    setIsSending({...isSending, notion: false});
  };

  // Handle send to Slack
  const handleSendToSlack = async () => {
    if (!summary) return;
    
    setIsSending({...isSending, slack: true});
    setIntegrationStatus({...integrationStatus, slack: 'Sending to Slack...'});
    
    try {
      const success = await sendUXAnalysisToSlack(summary);
      
      if (success) {
        setIntegrationStatus({...integrationStatus, slack: 'Successfully sent to Slack!'});
        setTimeout(() => {
          setIntegrationStatus({...integrationStatus, slack: ''});
        }, 5000);
      } else {
        setIntegrationStatus({...integrationStatus, slack: 'Failed to send to Slack'});
      }
    } catch (error) {
      setIntegrationStatus({...integrationStatus, slack: `Error: ${error.message}`});
    }
    
    setIsSending({...isSending, slack: false});
  };

  // Handle send regression alert
  const handleSendRegressionAlert = async () => {
    if (!summary) return;
    
    setIsSending({...isSending, regression: true});
    setIntegrationStatus({...integrationStatus, slack: 'Sending regression alert...'});
    
    try {
      // Create a mock regression based on current summary
      const mockRegression = {
        id: `test-${Date.now()}`,
        component: summary.component,
        project: summary.project || 'Test Project',
        previousScore: summary.overallScore + 10, // Simulate a regression
        currentScore: summary.overallScore,
        percentChange: -10,
        newIssues: 3,
        affectedPhases: Object.entries(summary.phaseScores || {})
          .map(([name, score]) => ({
            name,
            delta: -Math.floor(Math.random() * 10) - 1 // Random negative delta
          }))
          .slice(0, 3), // Just use up to 3 phases
        reportUrl: `https://example.com/reports/${Date.now()}`
      };
      
      const success = await sendRegressionAlertToSlack(mockRegression);
      
      if (success) {
        setIntegrationStatus({...integrationStatus, slack: 'Successfully sent regression alert!'});
        setTimeout(() => {
          setIntegrationStatus({...integrationStatus, slack: ''});
        }, 5000);
      } else {
        setIntegrationStatus({...integrationStatus, slack: 'Failed to send regression alert'});
      }
    } catch (error) {
      setIntegrationStatus({...integrationStatus, slack: `Error: ${error.message}`});
    }
    
    setIsSending({...isSending, regression: false});
  };

  // Handle send AI insights
  const handleSendInsights = async () => {
    if (!summary) return;
    
    setIsSending({...isSending, insights: true});
    setIntegrationStatus({...integrationStatus, slack: 'Sending AI insights...'});
    
    try {
      // Create mock insights based on current summary
      const mockInsights = {
        component: summary.component,
        title: `UX Improvement Recommendations for ${summary.component}`,
        summary: `Analysis of the ${summary.component} component revealed several areas for improvement. The overall score is ${summary.overallScore.toFixed(1)}/100, with key issues identified in user flow and accessibility.`,
        recommendations: [
          'Improve form validation feedback to be more immediate and descriptive',
          'Add keyboard navigation support for all interactive elements',
          'Optimize loading states to provide better user feedback during async operations'
        ],
        reportUrl: `https://example.com/insights/${Date.now()}`
      };
      
      const success = await sendAIInsightsToSlack(mockInsights);
      
      if (success) {
        setIntegrationStatus({...integrationStatus, slack: 'Successfully sent AI insights!'});
        setTimeout(() => {
          setIntegrationStatus({...integrationStatus, slack: ''});
        }, 5000);
      } else {
        setIntegrationStatus({...integrationStatus, slack: 'Failed to send AI insights'});
      }
    } catch (error) {
      setIntegrationStatus({...integrationStatus, slack: `Error: ${error.message}`});
    }
    
    setIsSending({...isSending, insights: false});
  };
  
  return (
    <div className="ux-dashboard">
      {/* Mode Badge */}
      <div className="mode-badge" style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '5px 10px',
        borderRadius: '4px',
        backgroundColor: currentMode === 'prod' ? '#4CAF50' : '#FF9800',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '14px',
        zIndex: 100
      }}>
        {currentMode === 'prod' ? 'Real Mode' : 'Mock Mode'}
      </div>
      
      {/* Connection status */}
      {websocketUrl && (
        <div className="connection-status" style={{
          marginBottom: '10px',
          padding: '5px',
          backgroundColor: connected ? '#e8f5e9' : '#ffebee',
          color: connected ? '#2e7d32' : '#c62828',
          borderRadius: '4px'
        }}>
          {connected ? 'Connected to live data' : 'Disconnected - Using cached data'}
        </div>
      )}
      
      <div className="dashboard-header">
        <h1>UX Enhancement Dashboard</h1>
        
        <div className="summary-meta">
          <div className="meta-item">
            <span className="meta-label">App:</span>
            <span className="meta-value">{summary.appName}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Version:</span>
            <span className="meta-value">{summary.version}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Last Update:</span>
            <span className="meta-value">
              {new Date(summary.timestamp).toLocaleString()}
            </span>
          </div>
          {summary.componentName && (
            <div className="meta-item">
              <span className="meta-label">Component:</span>
              <span className="meta-value">{summary.componentName}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="dashboard-score">
        <div 
          className="score-circle" 
          style={{ 
            background: `conic-gradient(
              ${getScoreColor(summary.overallScore, summary.maxScore)} 
              ${(summary.overallScore / summary.maxScore) * 360}deg, 
              #e0e0e0 0deg
            )`
          }}
        >
          <div className="score-inner">
            <span className="score-value">{summary.overallScore}</span>
            <span className="score-max">/{summary.maxScore}</span>
          </div>
        </div>
        
        <div className="score-phases">
          {summary.phases.map((phase) => (
            <div className="phase-score" key={phase.phase}>
              <div className="phase-title">{phase.phase}</div>
              <div className="phase-bar-container">
                <div 
                  className="phase-bar" 
                  style={{ 
                    width: `${(phase.score / phase.maxScore) * 100}%`,
                    backgroundColor: phaseColors[phase.phase] || '#999'
                  }}
                />
              </div>
              <div className="phase-score-text">
                {phase.score}/{phase.maxScore}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        marginBottom: '16px', 
        borderBottom: '1px solid #ddd',
        padding: '4px'
      }}>
        <div 
          onClick={() => setActiveTab('current')}
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            borderBottom: activeTab === 'current' ? '2px solid #4a90e2' : 'none',
            fontWeight: activeTab === 'current' ? 'bold' : 'normal',
            marginRight: '8px'
          }}
        >
          Current Analysis
        </div>
        
        {showHistory && (
          <div 
            onClick={() => setActiveTab('history')}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              borderBottom: activeTab === 'history' ? '2px solid #4a90e2' : 'none',
              fontWeight: activeTab === 'history' ? 'bold' : 'normal',
              marginRight: '8px'
            }}
          >
            📈 History
          </div>
        )}
        
        {showIntegrations && (
          <div 
            onClick={() => setActiveTab('integrations')}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              borderBottom: activeTab === 'integrations' ? '2px solid #4a90e2' : 'none',
              fontWeight: activeTab === 'integrations' ? 'bold' : 'normal'
            }}
          >
            🔌 Integrations
          </div>
        )}
      </div>
      
      <div className="tab-content">
        {/* Current Analysis Tab */}
        {activeTab === 'current' && (
          <div className="current-analysis-panel">
            {/* Issues Tab */}
            <div className="issues-panel">
              <div className="panel-header">
                <h2>
                  Issues 
                  {filteredIssues.length > 0 && <span className="issue-count">({filteredIssues.length})</span>}
                </h2>
                
                <div className="severity-counts">
                  <div className="severity-count" style={{ color: severityColors[SeverityLevel.CRITICAL] }}>
                    {issueCounts.critical} Critical
                  </div>
                  <div className="severity-count" style={{ color: severityColors[SeverityLevel.ERROR] }}>
                    {issueCounts.error} Errors
                  </div>
                  <div className="severity-count" style={{ color: severityColors[SeverityLevel.WARNING] }}>
                    {issueCounts.warning} Warnings
                  </div>
                  <div className="severity-count" style={{ color: severityColors[SeverityLevel.INFO] }}>
                    {issueCounts.info} Info
                  </div>
                </div>
                
                <div className="phase-filter">
                  <select 
                    value={activePhase} 
                    onChange={(e) => setActivePhase(e.target.value)}
                  >
                    <option value="all">All Phases</option>
                    {Object.values(PhaseType).map(phase => (
                      <option key={phase} value={phase}>{phase}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="issues-list">
                {filteredIssues.length === 0 ? (
                  <div className="no-issues">
                    {activePhase === 'all' 
                      ? 'No issues detected!' 
                      : `No issues for ${activePhase} phase`}
                  </div>
                ) : (
                  filteredIssues.map(issue => (
                    <div 
                      key={issue.id} 
                      className="issue-item"
                      style={{ borderLeft: `4px solid ${severityColors[issue.severity] || '#999'}` }}
                    >
                      <div className="issue-header">
                        <span className="issue-severity" style={{ color: severityColors[issue.severity] || '#999' }}>
                          {issue.severity}
                        </span>
                        <span className="issue-phase">{issue.phase}</span>
                        {issue.impact && <span className="issue-impact">Impact: {issue.impact}</span>}
                      </div>
                      
                      <div className="issue-message">{issue.message}</div>
                      
                      {issue.suggestion && (
                        <div className="issue-suggestion">
                          <strong>Suggestion:</strong> {issue.suggestion}
                        </div>
                      )}
                      
                      {issue.location && (
                        <div className="issue-location">
                          <strong>Location:</strong> {issue.location.file}
                          {issue.location.line > 0 && `:${issue.location.line}`}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* History Tab */}
        {activeTab === 'history' && showHistory && (
          <div className="history-panel">
            <div className="panel-header">
              <h2>Score Trend</h2>
            </div>
            
            <div className="trend-chart" style={{ height: '300px', marginBottom: '20px' }}>
              <Line 
                data={trendData} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      min: 0,
                      title: {
                        display: true,
                        text: 'Score'
                      }
                    },
                    x: {
                      title: {
                        display: true,
                        text: 'Date'
                      }
                    }
                  },
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return `Score: ${context.raw}`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
            
            <div className="panel-header">
              <h2>Recent Benchmarks</h2>
            </div>
            
            <div className="benchmark-list">
              {benchmarkHistory.length === 0 ? (
                <div className="no-benchmarks">No benchmark data available</div>
              ) : (
                benchmarkHistory.map((entry) => (
                  <div key={entry.id} className="benchmark-item">
                    <div className="benchmark-header">
                      <div className="benchmark-meta">
                        <div className="benchmark-date">
                          {formatDate(entry.timestamp)}
                        </div>
                        <div className="benchmark-component">
                          {entry.summary.componentName || entry.summary.appName || 'Unknown'}
                        </div>
                        {entry.branch && (
                          <div className="benchmark-branch">
                            Branch: {entry.branch}
                          </div>
                        )}
                      </div>
                      
                      <div className="benchmark-score-container">
                        <div className="benchmark-score">
                          <span style={{
                            color: getScoreColor(entry.summary.overallScore, entry.summary.maxScore)
                          }}>
                            {entry.summary.overallScore}/{entry.summary.maxScore}
                          </span>
                        </div>
                        
                        {entry.delta && (
                          <div className="benchmark-delta">
                            {formatDelta(entry.delta.overallScore)}
                            <span className="delta-percent">
                              ({entry.delta.percentChange > 0 ? '+' : ''}
                              {entry.delta.percentChange.toFixed(1)}%)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="benchmark-details">
                      <div className="benchmark-issues">
                        <strong>Issues:</strong> {entry.summary.issues.length}
                        {entry.delta && (
                          <>
                            {entry.delta.newIssues.length > 0 && (
                              <span className="new-issues" style={{ color: '#f44336', marginLeft: '8px' }}>
                                +{entry.delta.newIssues.length} new
                              </span>
                            )}
                            {entry.delta.resolvedIssues.length > 0 && (
                              <span className="resolved-issues" style={{ color: '#4caf50', marginLeft: '8px' }}>
                                -{entry.delta.resolvedIssues.length} resolved
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      
                      {entry.reportUrl && (
                        <a 
                          href={entry.reportUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="report-link"
                        >
                          View Report
                        </a>
                      )}
                    </div>
                    
                    {entry.delta && entry.delta.phaseDeltas && Object.keys(entry.delta.phaseDeltas).length > 0 && (
                      <div className="phase-deltas">
                        <div className="phase-deltas-title">Phase Changes:</div>
                        <div className="phase-deltas-list">
                          {Object.entries(entry.delta.phaseDeltas).map(([phase, delta]) => (
                            <div 
                              key={phase} 
                              className="phase-delta-item"
                              style={{ color: delta > 0 ? '#4caf50' : delta < 0 ? '#f44336' : '#757575' }}
                            >
                              <span className="phase-name">{phase}:</span>
                              <span className="phase-delta-value">
                                {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        
        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="integrations-panel" style={{ padding: '16px' }}>
            <h3 style={{ marginTop: 0 }}>Integration Test Panel</h3>
            
            {/* Notion Section */}
            <div style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <h4 style={{ margin: '0 0 16px 0' }}>Notion Integration</h4>
              
              <div style={{ marginBottom: '8px' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '100px' 
                }}>Status:</span>
                <span style={{ 
                  color: notionConfig.configured ? 'green' : 'gray',
                  fontWeight: 'bold'
                }}>
                  {notionConfig.configured ? 
                    (notionConfig.enabled ? 'Configured & Enabled' : 'Configured but Disabled') : 
                    'Not Configured'}
                </span>
              </div>
              
              <button 
                onClick={sendTestToNotion}
                disabled={!notionConfig.configured || !notionConfig.enabled || isSending.notion || !summary}
                style={{
                  padding: '8px 16px',
                  backgroundColor: notionConfig.configured && notionConfig.enabled ? '#4a90e2' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: notionConfig.configured && notionConfig.enabled ? 'pointer' : 'not-allowed',
                  marginRight: '8px'
                }}
              >
                {isSending.notion ? 'Sending...' : 'Send Test Analysis'}
              </button>
              
              <a 
                href="/settings#notion"
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}
              >
                Configure
              </a>
              
              {integrationStatus.notion && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: integrationStatus.notion.includes('Successfully') ? '#e6f7e6' : '#fff0f0',
                  borderRadius: '4px',
                  color: integrationStatus.notion.includes('Successfully') ? '#2e7d32' : '#c62828'
                }}>
                  {integrationStatus.notion}
                </div>
              )}
            </div>
            
            {/* Slack Section */}
            <div style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <h4 style={{ margin: '0 0 16px 0' }}>Slack Integration</h4>
              
              <div style={{ marginBottom: '8px' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '100px' 
                }}>Status:</span>
                <span style={{ 
                  color: slackConfig.configured ? 'green' : 'gray',
                  fontWeight: 'bold'
                }}>
                  {slackConfig.configured ? 
                    (slackConfig.enabled ? 'Configured & Enabled' : 'Configured but Disabled') : 
                    'Not Configured'}
                </span>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                <button 
                  onClick={sendTestToSlack}
                  disabled={!slackConfig.configured || !slackConfig.enabled || isSending.slack || !summary}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: slackConfig.configured && slackConfig.enabled ? '#4a90e2' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: slackConfig.configured && slackConfig.enabled ? 'pointer' : 'not-allowed'
                  }}
                >
                  {isSending.slack ? 'Sending...' : 'Send Test Analysis'}
                </button>
                
                <button 
                  onClick={sendTestRegressionToSlack}
                  disabled={!slackConfig.configured || !slackConfig.enabled || isSending.regression || !summary}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: slackConfig.configured && slackConfig.enabled ? '#e91e63' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: slackConfig.configured && slackConfig.enabled ? 'pointer' : 'not-allowed'
                  }}
                >
                  {isSending.regression ? 'Sending...' : 'Send Test Regression Alert'}
                </button>
                
                <button 
                  onClick={sendTestInsightsToSlack}
                  disabled={!slackConfig.configured || !slackConfig.enabled || isSending.insights || !summary}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: slackConfig.configured && slackConfig.enabled ? '#673ab7' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: slackConfig.configured && slackConfig.enabled ? 'pointer' : 'not-allowed'
                  }}
                >
                  {isSending.insights ? 'Sending...' : 'Send Test AI Insights'}
                </button>
              </div>
              
              <a 
                href="/settings#slack"
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}
              >
                Configure
              </a>
              
              {integrationStatus.slack && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: integrationStatus.slack.includes('Successfully') ? '#e6f7e6' : '#fff0f0',
                  borderRadius: '4px',
                  color: integrationStatus.slack.includes('Successfully') ? '#2e7d32' : '#c62828'
                }}>
                  {integrationStatus.slack}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Confirmation Modal */}
      {showConfirmation.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h3 style={{ marginTop: 0 }}>Confirm Action</h3>
            <p>{showConfirmation.message}</p>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => handleConfirmation(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmation(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#4a90e2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UXDashboard; 