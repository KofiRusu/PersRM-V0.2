import React, { useState, useEffect } from 'react';
import { CursorPersRMAgent, AgentOperationResult } from './PersRM';
import chokidar from 'chokidar';

interface PersRMUIProps {
  agent: CursorPersRMAgent;
  autoOptimize?: boolean; // New prop to enable/disable auto-optimization
  watchPath?: string; // Path to watch for changes
}

enum UITab {
  ANALYZE = 'analyze',
  OPTIMIZE = 'optimize',
  REPORT = 'report'
}

export const PersRMUI: React.FC<PersRMUIProps> = ({ 
  agent, 
  autoOptimize = false, 
  watchPath = './src/components' 
}) => {
  const [activeTab, setActiveTab] = useState<UITab>(UITab.ANALYZE);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AgentOperationResult | null>(null);
  const [reportFormat, setReportFormat] = useState<'html' | 'md' | 'json'>('html');
  const [customInputPath, setCustomInputPath] = useState<string>('');
  const [isWatcherActive, setIsWatcherActive] = useState<boolean>(false);

  // Function to run analysis
  const runAnalysis = async () => {
    setIsLoading(true);
    try {
      const analysisResult = await agent.analyzeProject();
      setResult(analysisResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to run optimization
  const runOptimization = async () => {
    setIsLoading(true);
    try {
      const optimizationResult = await agent.optimizeComponents();
      setResult(optimizationResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to generate report
  const generateReport = async () => {
    setIsLoading(true);
    try {
      const inputPath = customInputPath || undefined;
      const reportResult = await agent.generateReport(inputPath, reportFormat);
      setResult(reportResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Hot reload watcher effect
  useEffect(() => {
    if (autoOptimize) {
      try {
        setIsWatcherActive(true);
        // Watch for changes in components directory
        const watcher = chokidar.watch(watchPath, {
          persistent: true,
          ignoreInitial: true
        });
        
        watcher.on('change', async (changedPath) => {
          console.log(`File changed: ${changedPath}`);
          try {
            // Auto-run optimization when files change
            const optimizationResult = await agent.optimizeComponents();
            setResult(optimizationResult);
          } catch (error) {
            console.error('Auto-optimization error:', error);
            setResult({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        });
        
        // Clean up watcher on unmount
        return () => {
          watcher.close();
          setIsWatcherActive(false);
        };
      } catch (error) {
        console.error('Error setting up file watcher:', error);
        setIsWatcherActive(false);
      }
    }
  }, [agent, autoOptimize, watchPath]);

  // Styles
  const styles = {
    container: {
      padding: '20px',
      fontFamily: 'sans-serif',
      color: '#f0f0f0',
      backgroundColor: '#1e1e1e',
      minHeight: '100vh',
    },
    header: {
      marginBottom: '20px',
      borderBottom: '1px solid #444',
      paddingBottom: '10px',
    },
    tabs: {
      display: 'flex',
      marginBottom: '20px',
      borderBottom: '1px solid #444',
    },
    tab: {
      padding: '10px 20px',
      marginRight: '10px',
      cursor: 'pointer',
      borderRadius: '4px 4px 0 0',
    },
    activeTab: {
      backgroundColor: '#2e2e2e',
      borderBottom: '2px solid #0078d4',
    },
    button: {
      backgroundColor: '#0078d4',
      color: 'white',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      marginTop: '10px',
    },
    select: {
      backgroundColor: '#2e2e2e',
      color: '#f0f0f0',
      border: '1px solid #444',
      padding: '8px',
      borderRadius: '4px',
      marginRight: '10px',
    },
    input: {
      backgroundColor: '#2e2e2e',
      color: '#f0f0f0',
      border: '1px solid #444',
      padding: '8px',
      borderRadius: '4px',
      marginRight: '10px',
      width: '100%',
      marginBottom: '10px',
    },
    card: {
      backgroundColor: '#2e2e2e',
      padding: '20px',
      borderRadius: '4px',
      marginBottom: '20px',
    },
    form: {
      marginTop: '20px',
    },
    formGroup: {
      marginBottom: '15px',
    },
    label: {
      display: 'block',
      marginBottom: '5px',
    },
    resultContainer: {
      marginTop: '20px',
      padding: '20px',
      backgroundColor: '#2e2e2e',
      borderRadius: '4px',
      border: '1px solid #444',
    },
    error: {
      color: '#ff6b6b',
      fontWeight: 'bold',
    },
    success: {
      color: '#4cd964',
      fontWeight: 'bold',
    },
    metric: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid #444',
    },
    score: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#4cd964',
      textAlign: 'center' as const,
      marginBottom: '10px',
    },
    watcherStatus: {
      display: 'inline-block',
      padding: '5px 10px',
      borderRadius: '4px',
      marginLeft: '10px',
      fontSize: '12px',
      fontWeight: 'bold',
    },
    watcherActive: {
      backgroundColor: '#4cd964',
      color: '#1e1e1e',
    },
    watcherInactive: {
      backgroundColor: '#666',
      color: '#f0f0f0',
    },
  };

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case UITab.ANALYZE:
        return (
          <div>
            <h2>Run UX Analysis</h2>
            <p>Analyze the UI/UX of your project to identify issues and improvement opportunities.</p>
            <button 
              style={styles.button} 
              onClick={runAnalysis} 
              disabled={isLoading}
            >
              {isLoading ? 'Analyzing...' : 'Start Analysis'}
            </button>
          </div>
        );
      
      case UITab.OPTIMIZE:
        return (
          <div>
            <h2>
              Optimize Components
              {autoOptimize && (
                <span 
                  style={{
                    ...styles.watcherStatus, 
                    ...(isWatcherActive ? styles.watcherActive : styles.watcherInactive)
                  }}
                >
                  {isWatcherActive ? 'Auto-optimizing' : 'Watcher Inactive'}
                </span>
              )}
            </h2>
            <p>Run component optimization to get enhancement suggestions.</p>
            {autoOptimize && (
              <p>
                <small>
                  Watching for changes in: <code>{watchPath}</code>
                </small>
              </p>
            )}
            <button 
              style={styles.button} 
              onClick={runOptimization} 
              disabled={isLoading}
            >
              {isLoading ? 'Optimizing...' : 'Start Optimization'}
            </button>
          </div>
        );
      
      case UITab.REPORT:
        return (
          <div>
            <h2>Generate Report</h2>
            <p>Create a UX report from previous analysis or optimization results.</p>
            
            <div style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Report Format</label>
                <select
                  style={styles.select}
                  value={reportFormat}
                  onChange={(e) => setReportFormat(e.target.value as any)}
                  disabled={isLoading}
                >
                  <option value="html">HTML</option>
                  <option value="md">Markdown</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Custom Input Path (optional)</label>
                <input
                  type="text"
                  style={styles.input}
                  value={customInputPath}
                  onChange={(e) => setCustomInputPath(e.target.value)}
                  placeholder="Path to analysis/optimization result file"
                  disabled={isLoading}
                />
              </div>
              
              <button 
                style={styles.button} 
                onClick={generateReport} 
                disabled={isLoading}
              >
                {isLoading ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  // Render analysis/optimization result
  const renderResult = () => {
    if (!result) return null;

    if (!result.success) {
      return (
        <div style={styles.resultContainer}>
          <h3 style={styles.error}>Error</h3>
          <p>{result.error || 'An unknown error occurred'}</p>
        </div>
      );
    }

    return (
      <div style={styles.resultContainer}>
        <h3 style={styles.success}>Success</h3>
        
        {result.overallScore !== undefined && (
          <div style={styles.score}>
            {result.overallScore} / {result.maxScore}
          </div>
        )}
        
        {result.issuesCount !== undefined && (
          <div style={styles.metric}>
            <span>Issues Found:</span>
            <span>{result.issuesCount}</span>
          </div>
        )}
        
        {result.suggestionsCount !== undefined && (
          <div style={styles.metric}>
            <span>Suggestions:</span>
            <span>{result.suggestionsCount}</span>
          </div>
        )}
        
        {result.reportPath && (
          <div style={{...styles.metric, marginTop: '20px'}}>
            <span>Report Path:</span>
            <span>{result.reportPath}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>PersRM - UI/UX Performance Agent</h1>
        <p>Workspace: {agent.getWorkspacePath()}</p>
      </div>
      
      <div style={styles.tabs}>
        <div 
          style={{
            ...styles.tab,
            ...(activeTab === UITab.ANALYZE ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab(UITab.ANALYZE)}
        >
          Analyze
        </div>
        <div 
          style={{
            ...styles.tab,
            ...(activeTab === UITab.OPTIMIZE ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab(UITab.OPTIMIZE)}
        >
          Optimize
        </div>
        <div 
          style={{
            ...styles.tab,
            ...(activeTab === UITab.REPORT ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab(UITab.REPORT)}
        >
          Report
        </div>
      </div>
      
      <div style={styles.card}>
        {renderTabContent()}
      </div>
      
      {renderResult()}
    </div>
  );
};

export default PersRMUI; 