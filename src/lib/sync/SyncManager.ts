import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { UXEnhancementSummary } from '../persrm/types';
import { BenchmarkTracker } from '../benchmarks/BenchmarkTracker';

export interface SyncConfig {
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel?: string;
    username?: string;
  };
  notion?: {
    enabled: boolean;
    apiKey: string;
    databaseId: string;
  };
  github?: {
    enabled: boolean;
    token: string;
    owner: string;
    repo: string;
  };
  jira?: {
    enabled: boolean;
    baseUrl: string;
    username: string;
    apiToken: string;
    projectKey: string;
  };
}

export interface SyncOptions {
  /** Path to the sync configuration file */
  configPath?: string;
  /** In-memory sync configuration (overrides file config) */
  config?: SyncConfig;
  /** Automatically sync after each analysis */
  autoSync?: boolean;
  /** Include enhanced details in sync content */
  detailedSync?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
}

export interface SyncResult {
  success: boolean;
  platform: string;
  timestamp: string;
  url?: string;
  error?: string;
  syncedEntityId?: string;
}

export class SyncManager {
  private config: SyncConfig;
  private benchmarkTracker: BenchmarkTracker;
  private syncHistory: SyncResult[] = [];
  private options: SyncOptions;
  
  constructor(options: SyncOptions) {
    this.options = {
      autoSync: false,
      detailedSync: true,
      verbose: false,
      ...options
    };
    
    this.config = this.loadConfig();
    this.benchmarkTracker = new BenchmarkTracker();
    this.loadSyncHistory();
  }
  
  /**
   * Load sync configuration from file or use provided config
   */
  private loadConfig(): SyncConfig {
    // If config is provided in options, use that
    if (this.options.config) {
      return this.options.config;
    }
    
    // Otherwise, try to load from file
    if (this.options.configPath) {
      try {
        if (fs.existsSync(this.options.configPath)) {
          return fs.readJSONSync(this.options.configPath);
        }
      } catch (error) {
        console.error('Error loading sync config:', error);
      }
    }
    
    // Return empty config if none found
    return {};
  }
  
  /**
   * Load sync history from file
   */
  private loadSyncHistory(): void {
    const historyPath = this.getSyncHistoryPath();
    
    try {
      if (fs.existsSync(historyPath)) {
        this.syncHistory = fs.readJSONSync(historyPath);
        
        if (this.options.verbose) {
          console.log(`Loaded ${this.syncHistory.length} sync history entries.`);
        }
      }
    } catch (error) {
      console.error('Error loading sync history:', error);
    }
  }
  
  /**
   * Save sync history to file
   */
  private saveSyncHistory(): void {
    const historyPath = this.getSyncHistoryPath();
    
    try {
      fs.ensureDirSync(path.dirname(historyPath));
      fs.writeJSONSync(historyPath, this.syncHistory, { spaces: 2 });
      
      if (this.options.verbose) {
        console.log('Sync history saved successfully.');
      }
    } catch (error) {
      console.error('Error saving sync history:', error);
    }
  }
  
  /**
   * Get path to sync history file
   */
  private getSyncHistoryPath(): string {
    return path.resolve(process.cwd(), './persrm-reports/sync-history.json');
  }
  
  /**
   * Add a sync result to history
   */
  private addSyncResult(result: SyncResult): void {
    this.syncHistory.push(result);
    this.saveSyncHistory();
  }
  
  /**
   * Sync UX enhancement summary to configured platforms
   */
  public async syncEnhancementSummary(
    summary: UXEnhancementSummary, 
    metadata: { 
      commitSha?: string; 
      author?: string;
      branch?: string;
      reportPath?: string;
    } = {}
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    
    // Add to benchmark tracker
    this.benchmarkTracker.addEntry(summary, metadata);
    
    // Calculate score change from previous run
    const latestEntry = this.benchmarkTracker.getLatestEntry();
    let scoreChange: string | undefined;
    
    if (latestEntry) {
      const previous = this.benchmarkTracker.getPreviousEntry(latestEntry.id);
      if (previous) {
        const change = latestEntry.summary.overallScore - previous.summary.overallScore;
        scoreChange = change > 0 ? `+${change}` : `${change}`;
      }
    }
    
    // Sync to all enabled platforms
    if (this.config.slack?.enabled) {
      const slackResult = await this.syncToSlack(summary, metadata, scoreChange);
      results.push(slackResult);
      this.addSyncResult(slackResult);
    }
    
    if (this.config.notion?.enabled) {
      const notionResult = await this.syncToNotion(summary, metadata, scoreChange);
      results.push(notionResult);
      this.addSyncResult(notionResult);
    }
    
    if (this.config.github?.enabled) {
      const githubResult = await this.syncToGitHub(summary, metadata, scoreChange);
      results.push(githubResult);
      this.addSyncResult(githubResult);
    }
    
    if (this.config.jira?.enabled) {
      const jiraResult = await this.syncToJira(summary, metadata, scoreChange);
      results.push(jiraResult);
      this.addSyncResult(jiraResult);
    }
    
    return results;
  }
  
  /**
   * Sync to Slack via webhook
   */
  private async syncToSlack(
    summary: UXEnhancementSummary,
    metadata: Record<string, any>,
    scoreChange?: string
  ): Promise<SyncResult> {
    if (!this.config.slack?.webhookUrl) {
      return {
        success: false,
        platform: 'slack',
        timestamp: new Date().toISOString(),
        error: 'Slack webhook URL not configured'
      };
    }
    
    try {
      // Prepare blocks for Slack message
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `PersRM UX Report: ${summary.componentName || 'Component'}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Score:* ${summary.overallScore}/${summary.maxScore} ${scoreChange ? `(${scoreChange})` : ''}`
            },
            {
              type: 'mrkdwn',
              text: `*Issues:* ${summary.issues.length}`
            },
            {
              type: 'mrkdwn',
              text: `*Date:* ${new Date(summary.timestamp).toLocaleString()}`
            },
            {
              type: 'mrkdwn',
              text: `*Component:* ${summary.componentName || 'N/A'}`
            }
          ]
        }
      ];
      
      // Add commit info if available
      if (metadata.commitSha) {
        blocks.push({
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Commit:* ${metadata.commitSha.substring(0, 7)}`
            },
            {
              type: 'mrkdwn',
              text: `*Author:* ${metadata.author || 'Unknown'}`
            },
            {
              type: 'mrkdwn',
              text: `*Branch:* ${metadata.branch || 'Unknown'}`
            }
          ]
        });
      }
      
      // Add issues section if detailed sync is enabled
      if (this.options.detailedSync && summary.issues.length > 0) {
        // Limit to top 5 issues to avoid message size limits
        const topIssues = summary.issues.slice(0, 5);
        
        const issueSection = {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Top Issues:*\n' + topIssues.map(issue => 
              `• ${issue.severity}: ${issue.message}`
            ).join('\n')
          }
        };
        
        blocks.push(issueSection);
      }
      
      // Add report link if available
      if (metadata.reportPath) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<file://${metadata.reportPath}|View Full Report>`
          }
        });
      }
      
      // Send to Slack
      const response = await axios.post(this.config.slack.webhookUrl, {
        username: this.config.slack.username || 'PersRM UX Report',
        channel: this.config.slack.channel,
        blocks
      });
      
      if (response.status === 200) {
        return {
          success: true,
          platform: 'slack',
          timestamp: new Date().toISOString(),
          syncedEntityId: 'slack-message'
        };
      } else {
        return {
          success: false,
          platform: 'slack',
          timestamp: new Date().toISOString(),
          error: `Unexpected response: ${response.status}`
        };
      }
    } catch (error) {
      console.error('Error syncing to Slack:', error);
      return {
        success: false,
        platform: 'slack',
        timestamp: new Date().toISOString(),
        error: error.message || 'Unknown error'
      };
    }
  }
  
  /**
   * Sync to Notion via API
   */
  private async syncToNotion(
    summary: UXEnhancementSummary,
    metadata: Record<string, any>,
    scoreChange?: string
  ): Promise<SyncResult> {
    if (!this.config.notion?.apiKey || !this.config.notion?.databaseId) {
      return {
        success: false,
        platform: 'notion',
        timestamp: new Date().toISOString(),
        error: 'Notion API key or database ID not configured'
      };
    }
    
    try {
      // Prepare data for Notion page
      const properties = {
        Name: {
          title: [
            {
              text: {
                content: `UX Report: ${summary.componentName || 'Component'}`
              }
            }
          ]
        },
        Component: {
          rich_text: [
            {
              text: {
                content: summary.componentName || 'Unknown'
              }
            }
          ]
        },
        Score: {
          number: summary.overallScore
        },
        'Max Score': {
          number: summary.maxScore
        },
        'Issues Count': {
          number: summary.issues.length
        },
        Date: {
          date: {
            start: summary.timestamp
          }
        },
        Status: {
          select: {
            name: summary.overallScore >= 80 ? 'Good' : 
                 summary.overallScore >= 60 ? 'Needs Improvement' : 'Poor'
          }
        }
      };
      
      // Add commit info if available
      if (metadata.commitSha) {
        properties['Commit'] = {
          rich_text: [
            {
              text: {
                content: metadata.commitSha.substring(0, 7)
              }
            }
          ]
        };
        
        properties['Author'] = {
          rich_text: [
            {
              text: {
                content: metadata.author || 'Unknown'
              }
            }
          ]
        };
        
        properties['Branch'] = {
          rich_text: [
            {
              text: {
                content: metadata.branch || 'Unknown'
              }
            }
          ]
        };
      }
      
      // Prepare content for the page
      const content = [];
      
      // Add score change if available
      if (scoreChange) {
        content.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: `Score Change: ${scoreChange}`,
                  link: null
                },
                annotations: {
                  bold: true,
                  code: false,
                  color: scoreChange.startsWith('+') ? 'green' : 'red'
                }
              }
            ]
          }
        });
      }
      
      // Add issues section
      if (summary.issues.length > 0) {
        // Add heading
        content.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'Issues',
                  link: null
                }
              }
            ]
          }
        });
        
        // Add issues as list
        summary.issues.forEach(issue => {
          content.push({
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: `${issue.severity}: ${issue.message}`,
                    link: null
                  },
                  annotations: {
                    bold: issue.severity === 'CRITICAL' || issue.severity === 'ERROR',
                    code: false,
                    color: issue.severity === 'CRITICAL' ? 'red' : 
                           issue.severity === 'ERROR' ? 'orange' : 
                           issue.severity === 'WARNING' ? 'yellow' : 'default'
                  }
                }
              ]
            }
          });
        });
      }
      
      // Create the page in Notion
      const response = await axios.post(
        'https://api.notion.com/v1/pages',
        {
          parent: { database_id: this.config.notion.databaseId },
          properties,
          children: content
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.notion.apiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          }
        }
      );
      
      return {
        success: true,
        platform: 'notion',
        timestamp: new Date().toISOString(),
        syncedEntityId: response.data.id,
        url: response.data.url
      };
    } catch (error) {
      console.error('Error syncing to Notion:', error);
      return {
        success: false,
        platform: 'notion',
        timestamp: new Date().toISOString(),
        error: error.message || 'Unknown error'
      };
    }
  }
  
  /**
   * Sync to GitHub as an issue or comment
   */
  private async syncToGitHub(
    summary: UXEnhancementSummary,
    metadata: Record<string, any>,
    scoreChange?: string
  ): Promise<SyncResult> {
    // This is a simplified implementation; a real one would use the GitHub API
    return {
      success: false,
      platform: 'github',
      timestamp: new Date().toISOString(),
      error: 'GitHub sync not fully implemented yet'
    };
  }
  
  /**
   * Sync to Jira as an issue or comment
   */
  private async syncToJira(
    summary: UXEnhancementSummary,
    metadata: Record<string, any>,
    scoreChange?: string
  ): Promise<SyncResult> {
    // This is a simplified implementation; a real one would use the Jira API
    return {
      success: false,
      platform: 'jira',
      timestamp: new Date().toISOString(),
      error: 'Jira sync not fully implemented yet'
    };
  }
  
  /**
   * Get sync history
   */
  public getSyncHistory(): SyncResult[] {
    return this.syncHistory;
  }
  
  /**
   * Configure a sync platform
   */
  public configurePlatform(platform: 'slack' | 'notion' | 'github' | 'jira', config: any): void {
    this.config[platform] = { ...this.config[platform], ...config };
    this.saveConfig();
  }
  
  /**
   * Save the current configuration
   */
  private saveConfig(): void {
    if (!this.options.configPath) {
      // Can't save without a config path
      return;
    }
    
    try {
      fs.ensureDirSync(path.dirname(this.options.configPath));
      fs.writeJSONSync(this.options.configPath, this.config, { spaces: 2 });
      
      if (this.options.verbose) {
        console.log('Sync configuration saved successfully.');
      }
    } catch (error) {
      console.error('Error saving sync configuration:', error);
    }
  }
} 