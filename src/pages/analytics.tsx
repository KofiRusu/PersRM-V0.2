import React, { useState, useEffect } from 'react';
import { 
  getBenchmarkHistory, 
  getBenchmarkTrend, 
  findRegressions,
  getBenchmarkComparison,
  EnhancedBenchmarkEntry,
  BenchmarkFilter
} from '../lib/analytics/benchmark';
import { PhaseType } from '../lib/persrm/types';
import { 
  Line, 
  Bar
} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartData
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Color mapping for phase types
const phaseColors: Record<string, string> = {
  [PhaseType.LOAD_TIME]: '#4caf50',
  [PhaseType.RESPONSIVENESS]: '#2196f3',
  [PhaseType.ACCESSIBILITY]: '#9c27b0',
  [PhaseType.VISUAL_CONSISTENCY]: '#ff9800',
  [PhaseType.ANIMATIONS]: '#f44336',
  [PhaseType.DESIGN_TOKENS]: '#009688'
};

const AnalyticsPage: React.FC = () => {
  // State for active tab
  const [activeTab, setActiveTab] = useState<'trends' | 'phases' | 'regressions'>('trends');
  
  // State for filter options
  const [filter, setFilter] = useState<BenchmarkFilter>({});
  
  // State for benchmark data
  const [benchmarkHistory, setBenchmarkHistory] = useState<EnhancedBenchmarkEntry[]>([]);
  
  // State for trend data
  const [trendData, setTrendData] = useState<ChartData<'line'>>({
    labels: [],
    datasets: [{
      label: 'Overall Score',
      data: [],
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.5)',
      tension: 0.1
    }]
  });
  
  // State for phase delta data
  const [phaseDeltaData, setPhaseDeltaData] = useState<ChartData<'bar'>>({
    labels: [],
    datasets: []
  });
  
  // State for regression data
  const [regressions, setRegressions] = useState<EnhancedBenchmarkEntry[]>([]);
  
  // State for projects and components lists (for filters)
  const [projects, setProjects] = useState<string[]>([]);
  const [components, setComponents] = useState<string[]>([]);
  
  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);
  
  // Load data when filter changes
  useEffect(() => {
    loadData();
  }, [filter]);
  
  // Load all benchmark data
  const loadData = async () => {
    try {
      // Get benchmark history
      const history = getBenchmarkHistory(50, filter);
      setBenchmarkHistory(history);
      
      // Calculate unique projects and components for filters
      const projectSet = new Set<string>();
      const componentSet = new Set<string>();
      
      history.forEach(entry => {
        if (entry.summary.appName) {
          projectSet.add(entry.summary.appName);
        }
        if (entry.summary.componentName) {
          componentSet.add(entry.summary.componentName);
        }
      });
      
      setProjects(Array.from(projectSet));
      setComponents(Array.from(componentSet));
      
      // Get trend data
      const trend = getBenchmarkTrend(20, filter);
      
      // Prepare trend data for chart
      if (trend.timestamps.length > 0) {
        // Format dates for chart labels
        const labels = trend.timestamps.map(timestamp => {
          const date = new Date(timestamp);
          return date.toLocaleDateString();
        });
        
        setTrendData({
          labels,
          datasets: [{
            label: 'Overall Score',
            data: trend.scores,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            tension: 0.1
          }, {
            label: 'Issues',
            data: trend.issuesCounts,
            borderColor: '#f44336',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            fill: true,
            tension: 0.3,
            yAxisID: 'y1'
          }]
        });
        
        // Prepare phase delta data
        const phaseLabels = labels;
        const phaseDatasets = Object.entries(trend.phaseTrends).map(([phase, scores]) => ({
          label: phase,
          data: scores,
          borderColor: phaseColors[phase] || '#999',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3
        }));
        
        setPhaseDeltaData({
          labels: phaseLabels,
          datasets: phaseDatasets
        });
      }
      
      // Get regression data
      const regressionData = findRegressions(filter, 3); // 3% threshold
      setRegressions(regressionData);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  // Format delta value with appropriate color and sign
  const formatDelta = (value?: number) => {
    if (value === undefined) return null;
    
    const sign = value > 0 ? '+' : '';
    const color = value > 0 ? '#4caf50' : value < 0 ? '#f44336' : '#757575';
    
    return (
      <span style={{ color, fontWeight: 'bold' }}>{sign}{value.toFixed(1)}</span>
    );
  };
  
  // Handle filter changes
  const handleFilterChange = (key: keyof BenchmarkFilter, value: any) => {
    if (!value) {
      // Remove the filter if value is empty
      const newFilter = { ...filter };
      delete newFilter[key];
      setFilter(newFilter);
    } else {
      setFilter({ ...filter, [key]: value });
    }
  };
  
  // Clear all filters
  const clearFilters = () => {
    setFilter({});
  };
  
  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <h1>UX Performance Analytics</h1>
        
        <div className="filter-panel">
          <div className="filter-row">
            <div className="filter-item">
              <label>Project:</label>
              <select 
                value={filter.project || ''} 
                onChange={(e) => handleFilterChange('project', e.target.value)}
              >
                <option value="">All Projects</option>
                {projects.map(project => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-item">
              <label>Component:</label>
              <select 
                value={filter.component || ''} 
                onChange={(e) => handleFilterChange('component', e.target.value)}
              >
                <option value="">All Components</option>
                {components.map(component => (
                  <option key={component} value={component}>{component}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-item">
              <label>Branch:</label>
              <input 
                type="text" 
                value={filter.branch || ''} 
                onChange={(e) => handleFilterChange('branch', e.target.value)} 
                placeholder="Branch name"
              />
            </div>
            
            <button 
              className="clear-filters-button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </header>
      
      <div className="tabs-header">
        <button 
          className={`tab-button ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          Score Trends
        </button>
        <button 
          className={`tab-button ${activeTab === 'phases' ? 'active' : ''}`}
          onClick={() => setActiveTab('phases')}
        >
          Phase Deltas
        </button>
        <button 
          className={`tab-button ${activeTab === 'regressions' ? 'active' : ''}`}
          onClick={() => setActiveTab('regressions')}
        >
          Issue Regressions
        </button>
      </div>
      
      <div className="tab-content">
        {/* Score Trends Tab */}
        {activeTab === 'trends' && (
          <div className="trends-tab">
            <div className="chart-container">
              <h2>Overall UX Score Trend</h2>
              
              {trendData.labels.length > 0 ? (
                <Line 
                  data={trendData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        min: 0,
                        max: 100,
                        title: {
                          display: true,
                          text: 'Score'
                        }
                      },
                      y1: {
                        min: 0,
                        position: 'right',
                        title: {
                          display: true,
                          text: 'Issues Count'
                        },
                        grid: {
                          drawOnChartArea: false
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
                            return `${context.dataset.label}: ${context.raw}`;
                          }
                        }
                      }
                    }
                  }}
                  height={300}
                />
              ) : (
                <div className="no-data">No trend data available</div>
              )}
            </div>
            
            <div className="history-list">
              <h2>Recent Benchmark Runs</h2>
              
              {benchmarkHistory.length === 0 ? (
                <div className="no-data">No benchmark data available</div>
              ) : (
                <div className="benchmark-runs">
                  {benchmarkHistory.map((entry) => (
                    <div key={entry.id} className="benchmark-item">
                      <div className="benchmark-header">
                        <div className="benchmark-timestamp">
                          {formatDate(entry.timestamp)}
                        </div>
                        <div className="benchmark-score">
                          Score: <strong>{entry.summary.overallScore}</strong>
                          {entry.delta && (
                            <span className="score-delta">
                              {formatDelta(entry.delta.overallScore)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="benchmark-details">
                        <div className="benchmark-meta">
                          <span className="meta-project">{entry.summary.appName || 'Unknown Project'}</span>
                          {entry.summary.componentName && (
                            <span className="meta-component">{entry.summary.componentName}</span>
                          )}
                          {entry.branch && (
                            <span className="meta-branch">{entry.branch}</span>
                          )}
                        </div>
                        
                        <div className="benchmark-issues">
                          Issues: {entry.summary.issues.length}
                          {entry.delta && entry.delta.issueCountDelta !== 0 && (
                            <span className="issues-delta">
                              {formatDelta(entry.delta.issueCountDelta)}
                            </span>
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Phase Deltas Tab */}
        {activeTab === 'phases' && (
          <div className="phases-tab">
            <div className="chart-container">
              <h2>Phase Performance Over Time</h2>
              
              {phaseDeltaData.labels.length > 0 ? (
                <Line 
                  data={phaseDeltaData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        min: 0,
                        max: 100,
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
                      }
                    }
                  }}
                  height={400}
                />
              ) : (
                <div className="no-data">No phase data available</div>
              )}
            </div>
            
            <div className="phase-comparisons">
              <h2>Phase Performance Analysis</h2>
              
              {benchmarkHistory.length >= 2 ? (
                <>
                  <div className="phase-summary">
                    <h3>Most Improved Phase</h3>
                    <div className="phase-improvement">
                      {calculateMostImprovedPhase()}
                    </div>
                    
                    <h3>Phases Needing Attention</h3>
                    <div className="phase-regressed">
                      {calculateRegresedPhases()}
                    </div>
                  </div>
                  
                  <div className="phase-details">
                    <h3>Latest Phase Deltas</h3>
                    
                    {benchmarkHistory.length > 0 && benchmarkHistory[0].delta ? (
                      <div className="phase-delta-chart">
                        <Bar 
                          data={{
                            labels: Object.keys(benchmarkHistory[0].delta?.phaseDeltas || {})
                              .filter(phase => benchmarkHistory[0].delta?.phaseDeltas[phase as PhaseType] !== undefined),
                            datasets: [{
                              label: 'Phase Score Change',
                              data: Object.keys(benchmarkHistory[0].delta?.phaseDeltas || {})
                                .filter(phase => benchmarkHistory[0].delta?.phaseDeltas[phase as PhaseType] !== undefined)
                                .map(phase => benchmarkHistory[0].delta?.phaseDeltas[phase as PhaseType] || 0),
                              backgroundColor: Object.keys(benchmarkHistory[0].delta?.phaseDeltas || {})
                                .filter(phase => benchmarkHistory[0].delta?.phaseDeltas[phase as PhaseType] !== undefined)
                                .map(phase => {
                                  const value = benchmarkHistory[0].delta?.phaseDeltas[phase as PhaseType] || 0;
                                  return value > 0 ? 'rgba(76, 175, 80, 0.6)' : 'rgba(244, 67, 54, 0.6)';
                                })
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              y: {
                                title: {
                                  display: true,
                                  text: 'Score Change'
                                }
                              }
                            },
                            plugins: {
                              legend: {
                                display: false
                              }
                            }
                          }}
                          height={300}
                        />
                      </div>
                    ) : (
                      <div className="no-data">No phase delta data available</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="no-data">Need at least two benchmark runs to analyze phases</div>
              )}
            </div>
          </div>
        )}
        
        {/* Issue Regressions Tab */}
        {activeTab === 'regressions' && (
          <div className="regressions-tab">
            <div className="regressions-summary">
              <h2>UX Score Regressions</h2>
              
              {regressions.length === 0 ? (
                <div className="no-data">No regressions detected! 🎉</div>
              ) : (
                <>
                  <div className="regression-count">
                    Detected {regressions.length} regression{regressions.length !== 1 ? 's' : ''} in recent runs.
                  </div>
                  
                  <div className="regressions-list">
                    {regressions.map((entry) => (
                      <div key={entry.id} className="regression-item">
                        <div className="regression-header">
                          <div className="regression-timestamp">
                            {formatDate(entry.timestamp)}
                          </div>
                          <div className="regression-score">
                            Score: <strong>{entry.summary.overallScore}</strong>
                            {entry.delta && (
                              <span className="score-delta">
                                {formatDelta(entry.delta.overallScore)}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="regression-details">
                          <div className="regression-meta">
                            <span className="meta-project">{entry.summary.appName || 'Unknown Project'}</span>
                            {entry.summary.componentName && (
                              <span className="meta-component">{entry.summary.componentName}</span>
                            )}
                            {entry.branch && (
                              <span className="meta-branch">{entry.branch}</span>
                            )}
                          </div>
                          
                          <div className="regression-issues">
                            <div className="issue-change">
                              <strong>New Issues:</strong> {entry.delta && entry.delta.issueCountDelta > 0 ? entry.delta.issueCountDelta : 0}
                            </div>
                            
                            <div className="regression-phases">
                              <strong>Affected Phases:</strong>
                              <div className="affected-phases">
                                {entry.delta && 
                                  Object.entries(entry.delta.phaseDeltas)
                                    .filter(([_, value]) => value < 0)
                                    .map(([phase, value]) => (
                                      <div 
                                        key={phase} 
                                        className="affected-phase"
                                        style={{ backgroundColor: `${phaseColors[phase] || '#999'}33` }}
                                      >
                                        {phase} ({formatDelta(value)})
                                      </div>
                                    ))
                                }
                              </div>
                            </div>
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
                        
                        <div className="regression-actions">
                          <button className="action-button">Prioritize</button>
                          <button className="action-button">Assign to Team</button>
                          <button className="action-button">Create PR</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      <style jsx>{`
        .analytics-page {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          color: #333;
        }
        
        .analytics-header {
          margin-bottom: 30px;
        }
        
        h1 {
          margin: 0 0 20px 0;
          color: #333;
        }
        
        h2 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 1.4rem;
        }
        
        h3 {
          margin: 15px 0 10px 0;
          color: #555;
          font-size: 1.1rem;
        }
        
        .filter-panel {
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        
        .filter-row {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
        }
        
        .filter-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 150px;
        }
        
        .filter-item label {
          font-size: 0.9rem;
          font-weight: 500;
        }
        
        .filter-item select, .filter-item input {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        
        .clear-filters-button {
          background-color: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 8px 15px;
          cursor: pointer;
          transition: all 0.2s;
          align-self: flex-end;
        }
        
        .clear-filters-button:hover {
          background-color: #e0e0e0;
        }
        
        .tabs-header {
          display: flex;
          border-bottom: 1px solid #ddd;
          margin-bottom: 20px;
        }
        
        .tab-button {
          padding: 12px 20px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
        }
        
        .tab-button:hover {
          background-color: #f0f0f0;
        }
        
        .tab-button.active {
          font-weight: 600;
          border-bottom: 3px solid #2196f3;
        }
        
        .chart-container {
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
          height: 400px;
        }
        
        .no-data {
          text-align: center;
          padding: 40px;
          color: #999;
          font-style: italic;
        }
        
        .history-list, .phase-comparisons, .regressions-summary {
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .benchmark-runs, .regressions-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
          max-height: 500px;
          overflow-y: auto;
        }
        
        .benchmark-item, .regression-item {
          background-color: #f9f9f9;
          border-radius: 6px;
          padding: 15px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        
        .regression-item {
          border-left: 4px solid #f44336;
        }
        
        .benchmark-header, .regression-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid #eee;
        }
        
        .benchmark-timestamp, .regression-timestamp {
          font-size: 0.9rem;
          color: #666;
        }
        
        .benchmark-score, .regression-score {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .score-delta, .issues-delta {
          margin-left: 5px;
        }
        
        .benchmark-details, .regression-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .benchmark-meta, .regression-meta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        
        .meta-project, .meta-component, .meta-branch {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.85rem;
          background-color: #e3f2fd;
          color: #1976d2;
        }
        
        .meta-component {
          background-color: #e8f5e9;
          color: #388e3c;
        }
        
        .meta-branch {
          background-color: #fff3e0;
          color: #e64a19;
        }
        
        .benchmark-issues, .regression-issues {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.9rem;
        }
        
        .report-link {
          color: #2196f3;
          text-decoration: none;
          font-size: 0.9rem;
          margin-left: auto;
        }
        
        .report-link:hover {
          text-decoration: underline;
        }
        
        .affected-phases {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }
        
        .affected-phase {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.85rem;
        }
        
        .regression-actions {
          margin-top: 15px;
          display: flex;
          gap: 10px;
        }
        
        .action-button {
          padding: 8px 12px;
          border: none;
          border-radius: 4px;
          background-color: #f0f0f0;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.9rem;
        }
        
        .action-button:hover {
          background-color: #e0e0e0;
        }
        
        .phase-improvement, .phase-regressed {
          padding: 10px;
          border-radius: 6px;
          font-size: 0.95rem;
        }
        
        .phase-improvement {
          background-color: rgba(76, 175, 80, 0.1);
          color: #388e3c;
          margin-bottom: 15px;
        }
        
        .phase-regressed {
          background-color: rgba(244, 67, 54, 0.1);
          color: #d32f2f;
        }
        
        .phase-details, .phase-summary {
          margin-top: 20px;
        }
        
        .phase-delta-chart {
          height: 300px;
        }
        
        @media (max-width: 768px) {
          .filter-row {
            flex-direction: column;
            gap: 10px;
          }
          
          .benchmark-details, .regression-details {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          
          .report-link {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  );
  
  // Helper to calculate the most improved phase
  function calculateMostImprovedPhase() {
    if (benchmarkHistory.length < 2 || !benchmarkHistory[0].delta) {
      return 'Not enough data';
    }
    
    const phaseDeltas = benchmarkHistory[0].delta.phaseDeltas;
    let mostImprovedPhase = '';
    let highestImprovement = -Infinity;
    
    for (const [phase, delta] of Object.entries(phaseDeltas)) {
      if (delta > highestImprovement) {
        mostImprovedPhase = phase;
        highestImprovement = delta;
      }
    }
    
    if (mostImprovedPhase && highestImprovement > 0) {
      return (
        <div>
          <strong>{mostImprovedPhase}</strong> improved by <strong>{highestImprovement.toFixed(1)} points</strong>
        </div>
      );
    }
    
    return 'No improvements detected';
  }
  
  // Helper to calculate regressed phases
  function calculateRegresedPhases() {
    if (benchmarkHistory.length < 2 || !benchmarkHistory[0].delta) {
      return 'Not enough data';
    }
    
    const phaseDeltas = benchmarkHistory[0].delta.phaseDeltas;
    const regressedPhases = Object.entries(phaseDeltas)
      .filter(([_, delta]) => delta < 0)
      .sort(([_, deltaA], [__, deltaB]) => deltaA - deltaB); // Sort by most regression first
    
    if (regressedPhases.length === 0) {
      return 'No regressions detected!';
    }
    
    return (
      <div>
        {regressedPhases.map(([phase, delta]) => (
          <div key={phase} style={{ marginBottom: '5px' }}>
            <strong>{phase}</strong>: {formatDelta(delta)} points
          </div>
        ))}
      </div>
    );
  }
};

export default AnalyticsPage; 