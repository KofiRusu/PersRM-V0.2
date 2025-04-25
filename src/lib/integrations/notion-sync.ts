import { Client } from '@notionhq/client';
import fs from 'fs-extra';
import path from 'path';
import { UXEnhancementSummary, UXIssue, PhaseType } from '../persrm/types';
import { ComponentLearningData } from '../feedback/learner';
import { EnhancedBenchmarkEntry } from '../analytics/benchmark';

/**
 * Configuration for Notion integration
 */
export interface NotionSyncConfig {
  token: string;
  databaseId: string;
  enabled: boolean;
  autoSync: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: NotionSyncConfig = {
  token: '',
  databaseId: '',
  enabled: false,
  autoSync: false
};

/**
 * Service for syncing UX analysis data to Notion
 */
export class NotionSyncService {
  private client: Client | null = null;
  private config: NotionSyncConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.resolve(process.cwd(), '.persrm', 'notion-config.json');
    this.config = this.loadConfig();
    this.initClient();
  }

  /**
   * Initialize the Notion client with the configured token
   */
  private initClient(): void {
    if (this.config.token && this.config.enabled) {
      try {
        this.client = new Client({
          auth: this.config.token
        });
      } catch (error) {
        console.error('Failed to initialize Notion client:', error);
        this.client = null;
      }
    }
  }

  /**
   * Load configuration from disk
   */
  private loadConfig(): NotionSyncConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = fs.readJSONSync(this.configPath);
        return { ...DEFAULT_CONFIG, ...config };
      }
    } catch (error) {
      console.error('Error loading Notion config:', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Save configuration to disk
   */
  private saveConfig(): void {
    try {
      fs.ensureDirSync(path.dirname(this.configPath));
      fs.writeJSONSync(this.configPath, this.config, { spaces: 2 });
    } catch (error) {
      console.error('Error saving Notion config:', error);
    }
  }

  /**
   * Update the configuration
   * @param config New configuration values
   */
  public updateConfig(config: Partial<NotionSyncConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
    this.initClient();
  }

  /**
   * Check if Notion sync is enabled and properly configured
   */
  public isConfigured(): boolean {
    return !!(this.config.enabled && this.config.token && this.config.databaseId && this.client);
  }

  /**
   * Push a UX analysis summary to Notion
   * @param summary The UX enhancement summary to push
   * @param metadata Additional metadata to include
   * @returns The ID of the created page or null if failed
   */
  public async pushAnalysisSummary(
    summary: UXEnhancementSummary,
    metadata: {
      branch?: string;
      commitSha?: string;
      author?: string;
      reportUrl?: string;
    } = {}
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      console.error('Notion sync is not properly configured');
      return null;
    }

    try {
      // Normalize score to 0-100 scale for consistency
      const normalizedScore = summary.maxScore !== 100 
        ? Math.round((summary.overallScore / summary.maxScore) * 100) 
        : summary.overallScore;
      
      // Calculate score percentile for status
      const scorePercentage = (normalizedScore / 100) * 100;
      
      // Generate a more structured title for better grouping and sorting
      const projectPrefix = summary.appName ? `${summary.appName}` : 'App';
      const componentPart = summary.componentName ? ` → ${summary.componentName}` : '';
      const datePart = new Date(summary.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD format
      const structuredTitle = `${projectPrefix}${componentPart} (${datePart})`;
      
      const response = await this.client!.pages.create({
        parent: { database_id: this.config.databaseId },
        properties: {
          // Title with structured format for better grouping
          title: {
            title: [
              {
                text: {
                  content: structuredTitle
                }
              }
            ]
          },
          // Normalized overall score (0-100)
          "Score": {
            number: normalizedScore
          },
          // Raw score and max score
          "Raw Score": {
            rich_text: [
              {
                text: {
                  content: `${summary.overallScore}/${summary.maxScore}`
                }
              }
            ]
          },
          // Project/app name as a property for filtering and sorting
          "Project": {
            select: {
              name: summary.appName || 'Unknown'
            }
          },
          // Component name as a property for filtering and sorting
          "Component": {
            rich_text: [
              {
                text: {
                  content: summary.componentName || 'N/A'
                }
              }
            ]
          },
          // Timestamp as a date property for timeline views
          "Date": {
            date: {
              start: summary.timestamp
            }
          },
          // Branch name for tracking changes across branches
          "Branch": {
            select: {
              name: metadata.branch || 'main'
            }
          },
          // Commit SHA for traceability
          "Commit": {
            rich_text: [
              {
                text: {
                  content: metadata.commitSha ? metadata.commitSha.substring(0, 7) : 'N/A'
                }
              }
            ]
          },
          // Author for accountability
          "Author": {
            rich_text: [
              {
                text: {
                  content: metadata.author || 'Unknown'
                }
              }
            ]
          },
          // Number of issues for quick overview
          "Issues": {
            number: summary.issues.length
          },
          // Type (component or app)
          "Type": {
            select: {
              name: summary.componentName ? 'Component' : 'Application'
            }
          },
          // Analysis duration
          "Duration": {
            number: summary.duration || 0
          },
          // Status based on score
          "Status": {
            select: {
              name: this.getStatusFromScore(normalizedScore, 100)
            }
          },
          // Primary phase with lowest score (needs most attention)
          "Primary Phase": {
            select: {
              name: this.getPrimaryPhaseFromSummary(summary)
            }
          }
        },
        // Page content
        children: [
          // Summary section
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'UX Enhancement Summary' } }]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { 
                  type: 'text', 
                  text: { content: 'Overall Score: ' }
                },
                { 
                  type: 'text', 
                  text: { content: `${normalizedScore}/100` },
                  annotations: { bold: true }
                },
                { 
                  type: 'text', 
                  text: { content: ` (${scorePercentage.toFixed(1)}%)` }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { 
                  type: 'text', 
                  text: { content: 'Raw Score: ' }
                },
                { 
                  type: 'text', 
                  text: { content: `${summary.overallScore}/${summary.maxScore}` }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { 
                  type: 'text', 
                  text: { content: 'Issues: ' }
                },
                { 
                  type: 'text', 
                  text: { content: `${summary.issues.length}` },
                  annotations: { bold: true }
                }
              ]
            }
          },
          
          // Git info if available
          ...(metadata.commitSha ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { 
                    type: 'text', 
                    text: { content: 'Commit: ' }
                  },
                  { 
                    type: 'text', 
                    text: { content: metadata.commitSha },
                    annotations: { code: true }
                  }
                ]
              }
            }
          ] : []),
          ...(metadata.branch ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { 
                    type: 'text', 
                    text: { content: 'Branch: ' }
                  },
                  { 
                    type: 'text', 
                    text: { content: metadata.branch },
                    annotations: { code: true }
                  }
                ]
              }
            }
          ] : []),
          ...(metadata.author ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { 
                    type: 'text', 
                    text: { content: 'Author: ' }
                  },
                  { 
                    type: 'text', 
                    text: { content: metadata.author }
                  }
                ]
              }
            }
          ] : []),
          
          // Divider before phase scores
          { object: 'block', type: 'divider', divider: {} },
          
          // Phase scores section with bar chart visualization
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'Phase Performance' } }]
            }
          },
          
          // Phase scores as a visual chart
          this.formatPhaseScores(summary),
          
          // Divider before issues
          { object: 'block', type: 'divider', divider: {} },
          
          // Issues section grouped by phase
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'Issues by Phase' } }]
            }
          },
          
          // Format issues grouped by phase
          ...this.formatIssuesByPhase(summary.issues),
          
          // Report link if available
          ...(metadata.reportUrl ? [
            { object: 'block', type: 'divider', divider: {} },
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { 
                    type: 'text', 
                    text: { content: 'View full analysis report: ' }
                  },
                  {
                    type: 'text',
                    text: { content: 'Open Report', link: { url: metadata.reportUrl } },
                    annotations: { bold: true, color: 'blue' }
                  }
                ]
              }
            }
          ] : [])
        ]
      });
      
      console.log(`Analysis pushed to Notion: ${response.url}`);
      return response.id;
    } catch (error) {
      console.error('Error pushing analysis to Notion:', error);
      return null;
    }
  }

  /**
   * Get the primary phase that needs most attention
   * @param summary The UX enhancement summary
   * @returns The phase name
   */
  private getPrimaryPhaseFromSummary(summary: UXEnhancementSummary): string {
    // Default to a generic phase if none can be determined
    let primaryPhase = 'General';
    let lowestScore = Infinity;
    
    // Find the phase with the lowest score ratio
    summary.phases.forEach(phase => {
      const scoreRatio = phase.score / phase.maxScore;
      if (scoreRatio < lowestScore) {
        lowestScore = scoreRatio;
        primaryPhase = phase.phase;
      }
    });
    
    return primaryPhase;
  }

  /**
   * Push learning data insights to Notion
   * @param learningData Component learning data
   * @returns The ID of the created page or null if failed
   */
  public async pushLearningData(learningData: ComponentLearningData): Promise<string | null> {
    if (!this.isConfigured()) {
      console.error('Notion sync is not properly configured');
      return null;
    }

    try {
      const response = await this.client!.pages.create({
        parent: { database_id: this.config.databaseId },
        properties: {
          // Title - component name
          title: {
            title: [
              {
                text: {
                  content: `${learningData.componentName} - Learning Insights`
                }
              }
            ]
          },
          // Improvement rate as percentage
          "Score": {
            number: learningData.improvementRate * 100
          },
          // Max is always 100%
          "Max Score": {
            number: 100
          },
          // Timestamp
          "Date": {
            date: {
              start: new Date().toISOString()
            }
          },
          // Number of suggestions
          "Issues": {
            number: learningData.suggestions.length
          },
          // Component as project
          "Project": {
            rich_text: [
              {
                text: {
                  content: learningData.componentName
                }
              }
            ]
          },
          // Type
          "Type": {
            select: {
              name: 'Learning'
            }
          },
          // Status based on improvement rate
          "Status": {
            select: {
              name: this.getStatusFromImprovement(learningData.improvementRate)
            }
          }
        },
        // Page content
        children: [
          // Summary section
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'Learning Summary' } }]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { 
                  type: 'text', 
                  text: { 
                    content: `Improvement Rate: ${(learningData.improvementRate * 100).toFixed(1)}%` 
                  },
                  annotations: { bold: true }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { type: 'text', text: { content: `First Analyzed: ${new Date(learningData.firstAnalyzedAt).toLocaleDateString()}` } }
              ]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { type: 'text', text: { content: `Last Analyzed: ${new Date(learningData.lastAnalyzedAt).toLocaleDateString()}` } }
              ]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { type: 'text', text: { content: `Optimization Attempts: ${learningData.optimizationAttempts}` } }
              ]
            }
          },
          
          // Stagnation info if applicable
          ...(learningData.stagnantSince ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { 
                    type: 'text', 
                    text: { content: `Stagnant Since: ${new Date(learningData.stagnantSince).toLocaleDateString()}` },
                    annotations: { color: 'orange' }
                  }
                ]
              }
            }
          ] : []),
          
          // Divider before suggestions
          { object: 'block', type: 'divider', divider: {} },
          
          // Suggestions section
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'Suggestions' } }]
            }
          },
          
          // Format suggestions as a bulleted list
          ...this.formatSuggestions(learningData.suggestions),
          
          // Divider before score history
          { object: 'block', type: 'divider', divider: {} },
          
          // Score history section
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'Score History' } }]
            }
          },
          
          // Format score history as a table
          this.formatScoreHistory(learningData.scoreHistory)
        ]
      });
      
      console.log(`Learning data pushed to Notion: ${response.url}`);
      return response.id;
    } catch (error) {
      console.error('Error pushing learning data to Notion:', error);
      return null;
    }
  }

  /**
   * Push benchmark data to Notion
   * @param benchmark Benchmark entry with data
   * @returns The ID of the created page or null if failed
   */
  public async pushBenchmarkData(benchmark: EnhancedBenchmarkEntry): Promise<string | null> {
    if (!this.isConfigured()) {
      console.error('Notion sync is not properly configured');
      return null;
    }

    try {
      const response = await this.client!.pages.create({
        parent: { database_id: this.config.databaseId },
        properties: {
          // Title - benchmark name/id
          title: {
            title: [
              {
                text: {
                  content: `Benchmark - ${new Date(benchmark.timestamp).toLocaleDateString()}`
                }
              }
            ]
          },
          // Overall score
          "Score": {
            number: benchmark.summary.overallScore
          },
          // Max possible score
          "Max Score": {
            number: benchmark.summary.maxScore
          },
          // Timestamp
          "Date": {
            date: {
              start: benchmark.timestamp
            }
          },
          // Project/app name
          "Project": {
            rich_text: [
              {
                text: {
                  content: benchmark.summary.appName || benchmark.summary.componentName || 'Unknown'
                }
              }
            ]
          },
          // Branch name if available
          "Branch": {
            rich_text: [
              {
                text: {
                  content: benchmark.branch || 'unknown'
                }
              }
            ]
          },
          // Type
          "Type": {
            select: {
              name: 'Benchmark'
            }
          },
          // Status based on score and delta
          "Status": {
            select: {
              name: benchmark.delta && benchmark.delta.overallScore > 0 
                ? 'Improved' 
                : benchmark.delta && benchmark.delta.overallScore < 0
                  ? 'Regressed'
                  : this.getStatusFromScore(benchmark.summary.overallScore, benchmark.summary.maxScore)
            }
          }
        },
        // Page content
        children: [
          // Summary section
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'Benchmark Summary' } }]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { 
                  type: 'text', 
                  text: { 
                    content: `Score: ${benchmark.summary.overallScore}/${benchmark.summary.maxScore}` 
                  },
                  annotations: { bold: true }
                }
              ]
            }
          },
          
          // Delta information if available
          ...(benchmark.delta ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { 
                    type: 'text', 
                    text: { 
                      content: `Score Change: ${benchmark.delta.overallScore >= 0 ? '+' : ''}${benchmark.delta.overallScore.toFixed(1)} (${benchmark.delta.percentChange.toFixed(1)}%)` 
                    },
                    annotations: { 
                      bold: true,
                      color: benchmark.delta.overallScore >= 0 ? 'green' : 'red'
                    }
                  }
                ]
              }
            }
          ] : []),
          
          // Report link if available
          ...(benchmark.reportUrl ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { 
                    type: 'text', 
                    text: { content: 'View detailed report: ' }
                  },
                  {
                    type: 'text',
                    text: { content: 'Open Report', link: { url: benchmark.reportUrl } },
                    annotations: { bold: true, color: 'blue' }
                  }
                ]
              }
            }
          ] : []),
          
          // Divider before phase scores
          { object: 'block', type: 'divider', divider: {} },
          
          // Phase scores section
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'Phase Scores' } }]
            }
          },
          
          // Format phase scores as a table
          this.formatPhaseScores(benchmark.summary, benchmark.delta?.phaseDeltas),
          
          // Divider before issues section
          { object: 'block', type: 'divider', divider: {} },
          
          // Issues section
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'Issues' } }]
            }
          },
          
          // Format issues by phase
          ...this.formatIssuesByPhase(benchmark.summary.issues)
        ]
      });
      
      console.log(`Benchmark pushed to Notion: ${response.url}`);
      return response.id;
    } catch (error) {
      console.error('Error pushing benchmark to Notion:', error);
      return null;
    }
  }

  /**
   * Determine a status label based on score percentage
   * @param score Current score
   * @param maxScore Maximum possible score
   * @returns Status label
   */
  private getStatusFromScore(score: number, maxScore: number): string {
    const percentage = (score / maxScore) * 100;
    
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 75) return 'Good';
    if (percentage >= 60) return 'Average';
    if (percentage >= 40) return 'Needs Improvement';
    return 'Critical';
  }

  /**
   * Determine a status label based on improvement rate
   * @param improvementRate Improvement rate (0-1)
   * @returns Status label
   */
  private getStatusFromImprovement(improvementRate: number): string {
    if (improvementRate >= 0.5) return 'Fast Progress';
    if (improvementRate >= 0.2) return 'Improving';
    if (improvementRate >= 0.05) return 'Slow Progress';
    if (improvementRate > 0) return 'Minimal Change';
    return 'Stagnant';
  }

  /**
   * Format UX issues grouped by phase for Notion
   * @param issues Array of UX issues
   * @returns Array of Notion blocks
   */
  private formatIssuesByPhase(issues: UXIssue[]): any[] {
    // Group issues by phase
    const issuesByPhase: Record<string, UXIssue[]> = {};
    
    issues.forEach(issue => {
      const phase = issue.phase || 'Other';
      if (!issuesByPhase[phase]) {
        issuesByPhase[phase] = [];
      }
      issuesByPhase[phase].push(issue);
    });
    
    // Format each phase as a toggle with bullet list
    const blocks: any[] = [];
    
    Object.entries(issuesByPhase).forEach(([phase, phaseIssues]) => {
      // Add a toggle block for the phase
      blocks.push({
        object: 'block',
        type: 'toggle',
        toggle: {
          rich_text: [{ 
            type: 'text', 
            text: { 
              content: `${phase} (${phaseIssues.length})` 
            },
            annotations: { bold: true }
          }],
          children: phaseIssues.map(issue => ({
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [{ 
                type: 'text', 
                text: { content: issue.message },
                annotations: { 
                  color: issue.severity === 'critical' 
                    ? 'red' 
                    : issue.severity === 'error' 
                      ? 'orange' 
                      : 'default'
                }
              }]
            }
          }))
        }
      });
    });
    
    return blocks;
  }

  /**
   * Format suggestions as Notion blocks
   * @param suggestions Array of learner suggestions
   * @returns Array of Notion blocks
   */
  private formatSuggestions(suggestions: ComponentLearningData['suggestions']): any[] {
    if (suggestions.length === 0) {
      return [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: 'No suggestions available.' } }]
        }
      }];
    }
    
    return suggestions.map(suggestion => ({
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{ 
          type: 'text', 
          text: { content: suggestion.description },
          annotations: { 
            color: suggestion.priority === 'high' 
              ? 'red' 
              : suggestion.priority === 'medium' 
                ? 'orange' 
                : 'blue',
            strikethrough: !!suggestion.implementedAt
          }
        }]
      }
    }));
  }

  /**
   * Format score history as a Notion table
   * @param history Array of score history entries
   * @returns Notion table block
   */
  private formatScoreHistory(history: ComponentLearningData['scoreHistory']): any {
    // Sort by timestamp
    const sortedHistory = [...history].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    return {
      object: 'block',
      type: 'table',
      table: {
        table_width: 3,
        has_column_header: true,
        has_row_header: false,
        children: [
          // Header row
          {
            object: 'block',
            type: 'table_row',
            table_row: {
              cells: [
                [{ type: 'text', text: { content: 'Date' } }],
                [{ type: 'text', text: { content: 'Score' } }],
                [{ type: 'text', text: { content: 'Flow' } }]
              ]
            }
          },
          // Data rows
          ...sortedHistory.map(entry => ({
            object: 'block',
            type: 'table_row',
            table_row: {
              cells: [
                [{ type: 'text', text: { content: new Date(entry.timestamp).toLocaleDateString() } }],
                [{ type: 'text', text: { content: entry.score.toFixed(1) } }],
                [{ type: 'text', text: { content: entry.flowId || 'N/A' } }]
              ]
            }
          }))
        ]
      }
    };
  }

  /**
   * Format phase scores as a Notion table
   * @param summary UX enhancement summary
   * @param phaseDeltas Optional phase deltas for comparison
   * @returns Notion table block
   */
  private formatPhaseScores(
    summary: UXEnhancementSummary,
    phaseDeltas?: Record<string, number>
  ): any {
    // Extract phase scores
    const phaseScores: Record<string, number> = {};
    const phaseMaxScores: Record<string, number> = {};
    
    // Initialize with 0 for all known phases
    Object.values(PhaseType).forEach(phase => {
      phaseScores[phase] = 0;
      phaseMaxScores[phase] = 0;
    });
    
    // Update with actual scores
    if (summary.phaseScores) {
      Object.entries(summary.phaseScores).forEach(([phase, score]) => {
        phaseScores[phase] = score;
      });
    }
    
    // Update with max scores
    if (summary.phaseMaxScores) {
      Object.entries(summary.phaseMaxScores).forEach(([phase, maxScore]) => {
        phaseMaxScores[phase] = maxScore;
      });
    }
    
    return {
      object: 'block',
      type: 'table',
      table: {
        table_width: phaseDeltas ? 4 : 3,
        has_column_header: true,
        has_row_header: false,
        children: [
          // Header row
          {
            object: 'block',
            type: 'table_row',
            table_row: {
              cells: [
                [{ type: 'text', text: { content: 'Phase' } }],
                [{ type: 'text', text: { content: 'Score' } }],
                [{ type: 'text', text: { content: 'Max' } }],
                ...(phaseDeltas ? [[{ type: 'text', text: { content: 'Change' } }]] : [])
              ]
            }
          },
          // Data rows
          ...Object.entries(phaseScores)
            .filter(([, score]) => score > 0 || phaseMaxScores[name] > 0)
            .map(([phase, score]) => ({
              object: 'block',
              type: 'table_row',
              table_row: {
                cells: [
                  [{ type: 'text', text: { content: phase } }],
                  [{ type: 'text', text: { content: score.toFixed(1) } }],
                  [{ type: 'text', text: { content: phaseMaxScores[phase].toFixed(1) } }],
                  ...(phaseDeltas ? [[{ 
                    type: 'text', 
                    text: { 
                      content: phaseDeltas[phase] 
                        ? `${phaseDeltas[phase] >= 0 ? '+' : ''}${phaseDeltas[phase].toFixed(1)}` 
                        : '-' 
                    },
                    annotations: {
                      color: phaseDeltas[phase] > 0 
                        ? 'green' 
                        : phaseDeltas[phase] < 0 
                          ? 'red' 
                          : 'default'
                    }
                  }]] : [])
                ]
              }
            }))
        ]
      }
    };
  }
}

// Export singleton instance
const notionSync = new NotionSyncService();
export default notionSync;

/**
 * Update Notion sync configuration
 * @param config Configuration to update
 */
export function updateNotionConfig(config: Partial<NotionSyncConfig>): void {
  notionSync.updateConfig(config);
}

/**
 * Push UX analysis summary to Notion
 * @param summary UX enhancement summary
 * @param metadata Additional metadata
 * @returns The ID of the created page or null if failed
 */
export function pushAnalysisToNotion(
  summary: UXEnhancementSummary,
  metadata: {
    branch?: string;
    commitSha?: string;
    author?: string;
    reportUrl?: string;
  } = {}
): Promise<string | null> {
  return notionSync.pushAnalysisSummary(summary, metadata);
}

/**
 * Push learning data insights to Notion
 * @param learningData Component learning data
 * @returns The ID of the created page or null if failed
 */
export function pushLearningToNotion(
  learningData: ComponentLearningData
): Promise<string | null> {
  return notionSync.pushLearningData(learningData);
}

/**
 * Push benchmark data to Notion
 * @param benchmark Benchmark entry
 * @returns The ID of the created page or null if failed
 */
export function pushBenchmarkToNotion(
  benchmark: EnhancedBenchmarkEntry
): Promise<string | null> {
  return notionSync.pushBenchmarkData(benchmark);
}

/**
 * Check if Notion sync is enabled and configured
 */
export function isNotionConfigured(): boolean {
  return notionSync.isConfigured();
} 