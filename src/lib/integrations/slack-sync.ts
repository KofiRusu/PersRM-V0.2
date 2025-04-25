import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { UXEnhancementSummary, UXIssue, SeverityLevel } from '../persrm/types';
import { ComponentLearningData } from '../feedback/learner';
import chalk from 'chalk';

/**
 * Configuration for Slack integration
 */
export interface SlackSyncConfig {
  webhookUrl: string;
  enabled: boolean;
  channel?: string;
  username?: string;
  iconEmoji?: string;
  minSeverity: SeverityLevel;
  autoSync: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: SlackSyncConfig = {
  webhookUrl: '',
  enabled: false,
  username: 'UX Analyzer',
  iconEmoji: ':chart_with_upwards_trend:',
  minSeverity: 'warning',
  autoSync: false
};

/**
 * Service for sending UX analysis alerts to Slack
 */
export class SlackSyncService {
  private config: SlackSyncConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.resolve(process.cwd(), '.persrm', 'slack-config.json');
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from disk
   */
  private loadConfig(): SlackSyncConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = fs.readJSONSync(this.configPath);
        return { ...DEFAULT_CONFIG, ...config };
      }
    } catch (error) {
      console.error('Error loading Slack config:', error);
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
      console.error('Error saving Slack config:', error);
    }
  }

  /**
   * Update the configuration
   * @param config New configuration values
   */
  public updateConfig(config: Partial<SlackSyncConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }

  /**
   * Check if Slack sync is enabled and properly configured
   */
  public isConfigured(): boolean {
    return !!(this.config.enabled && this.config.webhookUrl);
  }

  /**
   * Get severity level numeric value for filtering
   * @param severity Severity level
   * @returns Numeric value (higher is more severe)
   */
  private getSeverityValue(severity: SeverityLevel): number {
    switch (severity) {
      case 'critical': return 4;
      case 'error': return 3;
      case 'warning': return 2;
      case 'info': return 1;
      default: return 0;
    }
  }

  /**
   * Get severity emoji for Slack messages
   * @param severity Severity level
   * @returns Emoji string
   */
  private getSeverityEmoji(severity: SeverityLevel): string {
    switch (severity) {
      case 'critical': return ':red_circle:';
      case 'error': return ':large_orange_circle:';
      case 'warning': return ':large_yellow_circle:';
      case 'info': return ':large_blue_circle:';
      default: return ':white_circle:';
    }
  }

  /**
   * Get color for Slack attachment based on severity
   * @param severity Severity level
   * @returns Hex color code
   */
  private getSeverityColor(severity: SeverityLevel): string {
    switch (severity) {
      case 'critical': return '#FF0000'; // Red
      case 'error': return '#FF9900'; // Orange
      case 'warning': return '#FFCC00'; // Yellow
      case 'info': return '#3AA3E3'; // Blue
      default: return '#CCCCCC'; // Grey
    }
  }

  /**
   * Get overall status color for Slack based on score percentage
   * @param score Current score
   * @param maxScore Maximum possible score
   * @returns Hex color code
   */
  private getScoreColor(score: number, maxScore: number): string {
    const percentage = (score / maxScore) * 100;
    
    if (percentage >= 90) return '#36a64f'; // Green
    if (percentage >= 75) return '#2EB67D'; // Light Green
    if (percentage >= 60) return '#ECB22E'; // Yellow
    if (percentage >= 40) return '#E01E5A'; // Red
    return '#8E0000'; // Dark Red
  }

  /**
   * Format UX issues for Slack message
   * @param issues Array of UX issues
   * @param minSeverity Minimum severity level to include
   * @returns Formatted issues text
   */
  private formatIssues(issues: UXIssue[], minSeverity: SeverityLevel = 'info'): string {
    const minSeverityValue = this.getSeverityValue(minSeverity);
    const filteredIssues = issues.filter(issue => 
      this.getSeverityValue(issue.severity as SeverityLevel) >= minSeverityValue
    );
    
    if (filteredIssues.length === 0) {
      return 'No issues matching the specified severity.';
    }
    
    return filteredIssues.map(issue => {
      const emoji = this.getSeverityEmoji(issue.severity as SeverityLevel);
      return `${emoji} *${issue.severity.toUpperCase()}*: ${issue.message}`;
    }).join('\n');
  }

  /**
   * Send UX analysis summary to Slack
   * @param summary UX enhancement summary
   * @param metadata Additional metadata
   * @returns True if successful, false otherwise
   */
  public async sendAnalysisSummary(
    summary: UXEnhancementSummary,
    metadata: {
      branch?: string;
      commitSha?: string;
      author?: string;
      reportUrl?: string;
    } = {}
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.error('Slack sync is not properly configured');
      return false;
    }

    try {
      // Normalize score to 0-100 scale for consistency
      const normalizedScore = summary.maxScore !== 100 
        ? Math.round((summary.overallScore / summary.maxScore) * 100) 
        : summary.overallScore;

      // Filter issues based on minimum severity
      const minSeverityValue = this.getSeverityValue(this.config.minSeverity);
      const filteredIssues = summary.issues.filter(issue => 
        this.getSeverityValue(issue.severity as SeverityLevel) >= minSeverityValue
      );
      
      if (filteredIssues.length === 0 && this.config.minSeverity !== 'info') {
        console.log(`No issues with severity >= ${this.config.minSeverity}, skipping Slack notification`);
        return true;
      }
      
      // Calculate critical metrics for header
      const scorePercentage = (normalizedScore / 100) * 100;
      const criticalCount = summary.issues.filter(i => i.severity === SeverityLevel.CRITICAL).length;
      const errorCount = summary.issues.filter(i => i.severity === SeverityLevel.ERROR).length;
      
      const title = summary.componentName 
        ? `${summary.componentName} Component Analysis`
        : `${summary.appName || 'App'} UX Analysis`;
      
      // Create primary message with a more informative header
      const message = {
        username: this.config.username,
        icon_emoji: this.config.iconEmoji,
        channel: this.config.channel,
        text: criticalCount > 0 
          ? `🔴 *${title}* - ${criticalCount} critical issues detected!` 
          : errorCount > 0
            ? `🟠 *${title}* - ${errorCount} error issues detected`
            : `🟢 *${title}* - UX Analysis Complete`,
        attachments: [
          {
            color: this.getScoreColor(normalizedScore, 100),
            blocks: [
              {
                type: "section",
                fields: [
                  {
                    type: "mrkdwn",
                    text: `*Score:*\n${normalizedScore}/100 (${scorePercentage.toFixed(1)}%)`
                  },
                  {
                    type: "mrkdwn",
                    text: `*Issues:*\n${filteredIssues.length} issues found`
                  }
                ]
              },
              {
                type: "section",
                fields: [
                  {
                    type: "mrkdwn",
                    text: `*Project:*\n${summary.appName || 'N/A'}`
                  },
                  {
                    type: "mrkdwn",
                    text: `*Branch:*\n${metadata.branch || 'main'}`
                  }
                ]
              },
              ...(metadata.commitSha ? [
                {
                  type: "section",
                  fields: [
                    {
                      type: "mrkdwn",
                      text: `*Commit:*\n\`${metadata.commitSha.substring(0, 7)}\``
                    },
                    {
                      type: "mrkdwn", 
                      text: `*Author:*\n${metadata.author || 'Unknown'}`
                    }
                  ]
                }
              ] : []),
              ...(metadata.reportUrl ? [
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "View Full Report"
                      },
                      url: metadata.reportUrl,
                      style: "primary"
                    }
                  ]
                }
              ] : [])
            ]
          }
        ]
      };
      
      // Add phase summary section
      if (summary.phases && summary.phases.length > 0) {
        // Find the phase with the lowest score ratio
        let lowestPhase = summary.phases[0];
        let lowestRatio = lowestPhase.score / lowestPhase.maxScore;
        
        summary.phases.forEach(phase => {
          const ratio = phase.score / phase.maxScore;
          if (ratio < lowestRatio) {
            lowestRatio = ratio;
            lowestPhase = phase;
          }
        });
        
        // Add the phase summary attachment
        message.attachments.push({
          color: "#4a154b", // Slack purple
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "Phase Performance",
                emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Needs most attention:* ${lowestPhase.phase} (${lowestPhase.score}/${lowestPhase.maxScore})`
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: summary.phases.map(phase => {
                  const ratio = phase.score / phase.maxScore;
                  const emoji = ratio > 0.8 ? "🟢" : ratio > 0.6 ? "🟡" : "🔴";
                  return `${emoji} *${phase.phase}:* ${phase.score}/${phase.maxScore}`;
                }).join("\n")
              }
            }
          ]
        });
      }
      
      // Add critical issues section if any exist
      const criticalIssues = summary.issues.filter(i => 
        i.severity === SeverityLevel.CRITICAL || i.severity === SeverityLevel.ERROR
      );
      
      if (criticalIssues.length > 0) {
        message.attachments.push({
          color: "#ff0000", // Red for critical issues
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "Critical Issues",
                emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: criticalIssues.slice(0, 5).map(issue => {
                  const emoji = this.getSeverityEmoji(issue.severity as SeverityLevel);
                  return `${emoji} *${issue.phase}:* ${issue.message}`;
                }).join("\n") + (criticalIssues.length > 5 ? "\n_...and more_" : "")
              }
            }
          ]
        });
      }
      
      // Add all issues section
      message.attachments.push({
        color: "#f2c744", // Yellow
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `All Issues (${this.config.minSeverity}+)`,
              emoji: true
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: filteredIssues.length > 0 
                ? this.formatIssuesByPhase(filteredIssues)
                : "No issues matching the specified severity."
            }
          }
        ]
      });
      
      await axios.post(this.config.webhookUrl, message);
      console.log(`Analysis summary sent to Slack`);
      return true;
    } catch (error) {
      console.error('Error sending analysis to Slack:', error);
      return false;
    }
  }

  /**
   * Format issues grouped by phase
   * @param issues Array of UX issues
   * @returns Formatted text for Slack
   */
  private formatIssuesByPhase(issues: UXIssue[]): string {
    if (issues.length === 0) {
      return "No issues to display.";
    }
    
    // Group issues by phase
    const issuesByPhase = issues.reduce((groups, issue) => {
      const phase = issue.phase || 'General';
      if (!groups[phase]) {
        groups[phase] = [];
      }
      groups[phase].push(issue);
      return groups;
    }, {} as Record<string, UXIssue[]>);
    
    // Format each phase group
    let output = '';
    
    Object.entries(issuesByPhase).forEach(([phase, phaseIssues], index) => {
      if (index > 0) {
        output += '\n';
      }
      
      output += `*${phase}:*\n`;
      
      // Sort issues by severity
      phaseIssues.sort((a, b) => 
        this.getSeverityValue(b.severity as SeverityLevel) - 
        this.getSeverityValue(a.severity as SeverityLevel)
      );
      
      // Format issues with severity emoji
      phaseIssues.forEach(issue => {
        const emoji = this.getSeverityEmoji(issue.severity as SeverityLevel);
        output += `${emoji} ${issue.message}\n`;
      });
    });
    
    return output;
  }

  /**
   * Send learning data insights to Slack
   * @param learningData Component learning data
   * @returns True if successful, false otherwise
   */
  public async sendLearningData(learningData: ComponentLearningData): Promise<boolean> {
    if (!this.isConfigured()) {
      console.error('Slack sync is not properly configured');
      return false;
    }

    try {
      const improvementRate = (learningData.improvementRate * 100).toFixed(1);
      const highPrioritySuggestions = learningData.suggestions.filter(s => s.priority === 'high');
      
      const message = {
        username: this.config.username,
        icon_emoji: this.config.iconEmoji,
        channel: this.config.channel,
        text: `Learning insights for *${learningData.componentName}*`,
        attachments: [
          {
            color: learningData.improvementRate > 0.1 ? '#36a64f' : '#f2c744',
            fields: [
              {
                title: 'Improvement Rate',
                value: `${improvementRate}%`,
                short: true
              },
              {
                title: 'Optimization Attempts',
                value: `${learningData.optimizationAttempts}`,
                short: true
              },
              {
                title: 'First Analyzed',
                value: new Date(learningData.firstAnalyzedAt).toLocaleDateString(),
                short: true
              },
              {
                title: 'Last Analyzed',
                value: new Date(learningData.lastAnalyzedAt).toLocaleDateString(),
                short: true
              }
            ]
          },
          // High priority suggestions
          {
            color: '#E01E5A',
            title: `High Priority Suggestions (${highPrioritySuggestions.length})`,
            text: highPrioritySuggestions.length > 0 
              ? highPrioritySuggestions.map(s => `• ${s.description}`).join('\n')
              : 'No high priority suggestions.',
            mrkdwn_in: ['text']
          }
        ]
      };
      
      await axios.post(this.config.webhookUrl, message);
      console.log(`Learning data sent to Slack`);
      return true;
    } catch (error) {
      console.error('Error sending learning data to Slack:', error);
      return false;
    }
  }

  /**
   * Send benchmark comparison to Slack
   * @param current Current benchmark data
   * @param previous Previous benchmark data (optional)
   * @returns True if successful, false otherwise
   */
  public async sendBenchmarkComparison(
    current: UXEnhancementSummary,
    previous?: UXEnhancementSummary,
    metadata: {
      branch?: string;
      reportUrl?: string;
    } = {}
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.error('Slack sync is not properly configured');
      return false;
    }

    try {
      const scoreDiff = previous 
        ? current.overallScore - previous.overallScore 
        : 0;
      
      const percentDiff = previous 
        ? ((scoreDiff / previous.overallScore) * 100).toFixed(1) 
        : '0';

      const currentPercentage = ((current.overallScore / current.maxScore) * 100).toFixed(1);
      
      const title = current.componentName 
        ? `${current.componentName} Benchmark`
        : `${current.appName || 'App'} Benchmark`;
      
      // Find regressions - issues that are new or increased in severity
      const regressions = previous 
        ? current.issues.filter(issue => {
            const prevIssue = previous.issues.find(pi => 
              pi.message === issue.message && pi.phase === issue.phase
            );
            return !prevIssue || 
              this.getSeverityValue(issue.severity as SeverityLevel) > 
              this.getSeverityValue(prevIssue.severity as SeverityLevel);
          })
        : [];
      
      const message = {
        username: this.config.username,
        icon_emoji: this.config.iconEmoji,
        channel: this.config.channel,
        text: `Benchmark results for *${title}*`,
        attachments: [
          {
            color: scoreDiff >= 0 ? '#36a64f' : '#E01E5A',
            fields: [
              {
                title: 'Current Score',
                value: `${current.overallScore}/${current.maxScore} (${currentPercentage}%)`,
                short: true
              },
              {
                title: 'Score Change',
                value: scoreDiff !== 0 
                  ? `${scoreDiff > 0 ? '+' : ''}${scoreDiff.toFixed(1)} (${scoreDiff > 0 ? '+' : ''}${percentDiff}%)`
                  : 'No change',
                short: true
              },
              {
                title: 'Project',
                value: current.appName || 'N/A',
                short: true
              },
              {
                title: 'Branch',
                value: metadata.branch || 'main',
                short: true
              }
            ],
            actions: metadata.reportUrl ? [
              {
                type: 'button',
                text: 'View Full Report',
                url: metadata.reportUrl
              }
            ] : []
          }
        ]
      };
      
      // Add regressions section if there are any
      if (regressions.length > 0 && previous) {
        message.attachments.push({
          color: '#E01E5A',
          title: `Regressions (${regressions.length})`,
          text: this.formatIssues(regressions),
          mrkdwn_in: ['text']
        });
      }
      
      await axios.post(this.config.webhookUrl, message);
      console.log(`Benchmark comparison sent to Slack`);
      return true;
    } catch (error) {
      console.error('Error sending benchmark to Slack:', error);
      return false;
    }
  }

  /**
   * Send UX alert for a specific issue
   * @param issue The UX issue to alert on
   * @param context Context information
   * @returns True if successful, false otherwise
   */
  public async sendUXAlert(
    issue: UXIssue,
    context: {
      componentName?: string;
      appName?: string;
      filePath?: string;
      branch?: string;
      reportUrl?: string;
    }
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.error('Slack sync is not properly configured');
      return false;
    }

    // Only alert on issues with severity >= configured minimum
    if (this.getSeverityValue(issue.severity as SeverityLevel) < 
        this.getSeverityValue(this.config.minSeverity)) {
      return true;
    }

    try {
      const title = context.componentName || context.appName || 'UX Issue';
      
      const message = {
        username: this.config.username,
        icon_emoji: this.config.iconEmoji,
        channel: this.config.channel,
        text: `UX Alert for *${title}*`,
        attachments: [
          {
            color: this.getSeverityColor(issue.severity as SeverityLevel),
            fields: [
              {
                title: 'Severity',
                value: issue.severity.toUpperCase(),
                short: true
              },
              {
                title: 'Phase',
                value: issue.phase || 'Unknown',
                short: true
              },
              ...(context.filePath ? [{
                title: 'File',
                value: context.filePath,
                short: true
              }] : []),
              ...(context.branch ? [{
                title: 'Branch',
                value: context.branch,
                short: true
              }] : [])
            ],
            text: issue.message,
            actions: context.reportUrl ? [
              {
                type: 'button',
                text: 'View Report',
                url: context.reportUrl
              }
            ] : []
          }
        ]
      };
      
      await axios.post(this.config.webhookUrl, message);
      console.log(`UX alert sent to Slack for issue: ${issue.message}`);
      return true;
    } catch (error) {
      console.error('Error sending UX alert to Slack:', error);
      return false;
    }
  }

  /**
   * Send AI insights to Slack
   * @param insights The insights data to send
   * @param metadata Additional context
   * @returns True if successful, false otherwise
   */
  public async sendAIInsights(
    insights: {
      title: string;
      summary: string;
      recommendations: string[];
      score?: number;
    },
    metadata: {
      componentName?: string;
      appName?: string;
      reportUrl?: string;
    } = {}
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.error('Slack sync is not properly configured');
      return false;
    }

    try {
      const title = metadata.componentName || metadata.appName || insights.title;
      
      const message = {
        username: "AI UX Assistant",
        icon_emoji: ":robot_face:",
        channel: this.config.channel,
        text: `🧠 *AI UX Insights: ${title}*`,
        attachments: [
          {
            color: "#4A154B", // Slack purple
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Summary:*\n${insights.summary}`
                }
              },
              {
                type: "divider"
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "*Recommendations:*\n" + insights.recommendations.map(r => `• ${r}`).join('\n')
                }
              },
              ...(metadata.reportUrl ? [
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "View Details"
                      },
                      url: metadata.reportUrl
                    }
                  ]
                }
              ] : [])
            ]
          }
        ]
      };
      
      await axios.post(this.config.webhookUrl, message);
      console.log(`AI insights sent to Slack for ${title}`);
      return true;
    } catch (error) {
      console.error('Error sending AI insights to Slack:', error);
      return false;
    }
  }

  /**
   * Send regression alert to Slack
   * @param regression Regression data
   * @returns True if successful, false otherwise
   */
  public async sendRegressionAlert(
    regression: {
      id: string;
      component: string;
      project?: string;
      previousScore: number;
      currentScore: number;
      percentChange: number;
      newIssues: string[];
      affectedPhases: {name: string, delta: number}[];
      reportUrl?: string;
    }
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.error('Slack sync is not properly configured');
      return false;
    }

    try {
      const title = regression.component;
      const scoreChange = regression.currentScore - regression.previousScore;
      const percentChange = regression.percentChange;
      
      const message = {
        username: this.config.username,
        icon_emoji: ":warning:",
        channel: this.config.channel,
        text: `⚠️ *UX Regression Detected: ${title}*`,
        attachments: [
          {
            color: "#E01E5A", // Red
            blocks: [
              {
                type: "section",
                fields: [
                  {
                    type: "mrkdwn",
                    text: `*Previous Score:*\n${regression.previousScore.toFixed(1)}`
                  },
                  {
                    type: "mrkdwn",
                    text: `*Current Score:*\n${regression.currentScore.toFixed(1)}`
                  }
                ]
              },
              {
                type: "section",
                fields: [
                  {
                    type: "mrkdwn",
                    text: `*Change:*\n${scoreChange.toFixed(1)} (${percentChange.toFixed(1)}%)`
                  },
                  {
                    type: "mrkdwn",
                    text: `*Project:*\n${regression.project || 'Unknown'}`
                  }
                ]
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "*Affected Phases:*\n" + 
                    regression.affectedPhases.map(phase => 
                      `• ${phase.name}: ${phase.delta.toFixed(1)}`
                    ).join('\n')
                }
              },
              ...(regression.newIssues.length > 0 ? [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: "*New Issues:*\n" + 
                      regression.newIssues.slice(0, 5).map(issue => `• ${issue}`).join('\n') +
                      (regression.newIssues.length > 5 ? "\n_...and more_" : "")
                  }
                }
              ] : []),
              ...(regression.reportUrl ? [
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "View Report"
                      },
                      url: regression.reportUrl,
                      style: "danger"
                    }
                  ]
                }
              ] : [])
            ]
          }
        ]
      };
      
      await axios.post(this.config.webhookUrl, message);
      console.log(`Regression alert sent to Slack for ${title}`);
      return true;
    } catch (error) {
      console.error('Error sending regression alert to Slack:', error);
      return false;
    }
  }
}

// Export singleton instance
const slackSync = new SlackSyncService();
export default slackSync;

/**
 * Update Slack sync configuration
 * @param config Configuration to update
 */
export function updateSlackConfig(config: Partial<SlackSyncConfig>): void {
  slackSync.updateConfig(config);
}

/**
 * Send UX analysis summary to Slack
 * @param summary UX enhancement summary
 * @param metadata Additional metadata
 * @returns True if successful, false otherwise
 */
export function sendAnalysisToSlack(
  summary: UXEnhancementSummary,
  metadata: {
    branch?: string;
    commitSha?: string;
    author?: string;
    reportUrl?: string;
  } = {}
): Promise<boolean> {
  return slackSync.sendAnalysisSummary(summary, metadata);
}

/**
 * Send learning data insights to Slack
 * @param learningData Component learning data
 * @returns True if successful, false otherwise
 */
export function sendLearningToSlack(
  learningData: ComponentLearningData
): Promise<boolean> {
  return slackSync.sendLearningData(learningData);
}

/**
 * Send benchmark comparison to Slack
 * @param current Current benchmark data
 * @param previous Previous benchmark data (optional)
 * @returns True if successful, false otherwise
 */
export function sendBenchmarkToSlack(
  current: UXEnhancementSummary,
  previous?: UXEnhancementSummary,
  metadata: {
    branch?: string;
    reportUrl?: string;
  } = {}
): Promise<boolean> {
  return slackSync.sendBenchmarkComparison(current, previous, metadata);
}

/**
 * Send UX alert for a specific issue
 * @param issue The UX issue to alert on
 * @param context Context information
 * @returns True if successful, false otherwise
 */
export function sendUXAlert(
  issue: UXIssue,
  context: {
    componentName?: string;
    appName?: string;
    filePath?: string;
    branch?: string;
    reportUrl?: string;
  }
): Promise<boolean> {
  return slackSync.sendUXAlert(issue, context);
}

/**
 * Check if Slack sync is enabled and configured
 */
export function isSlackConfigured(): boolean {
  return slackSync.isConfigured();
}

/**
 * Send AI insights to Slack
 * @param insights The insights data
 * @param metadata Additional context
 * @returns True if successful, false otherwise
 */
export function sendAIInsightsToSlack(
  insights: {
    title: string;
    summary: string;
    recommendations: string[];
    score?: number;
  },
  metadata: {
    componentName?: string;
    appName?: string;
    reportUrl?: string;
  } = {}
): Promise<boolean> {
  return slackSync.sendAIInsights(insights, metadata);
}

/**
 * Send regression alert to Slack
 * @param regression Regression data
 * @returns True if successful, false otherwise
 */
export function sendRegressionAlertToSlack(
  regression: {
    id: string;
    component: string;
    project?: string;
    previousScore: number;
    currentScore: number;
    percentChange: number;
    newIssues: string[];
    affectedPhases: {name: string, delta: number}[];
    reportUrl?: string;
  }
): Promise<boolean> {
  return slackSync.sendRegressionAlert(regression);
}

/**
 * Send a regression alert to Slack
 * @param regressionData Details about the regression
 * @returns Promise<boolean> Success status
 */
export async function sendRegressionAlert(regressionData: {
  id: string;
  component: string;
  project?: string;
  previousScore: number;
  currentScore: number;
  percentChange: number;
  newIssues: number;
  affectedPhases: Array<{name: string, delta: number}>;
  reportUrl?: string;
}): Promise<boolean> {
  try {
    const config = getSlackConfig();
    
    if (!config || !config.enabled || !config.webhookUrl) {
      console.log(chalk.yellow('Slack integration not configured or disabled'));
      return false;
    }
    
    // Format the date as YYYY-MM-DD
    const date = new Date().toISOString().split('T')[0];
    
    // Main header with emoji based on severity
    const emoji = regressionData.percentChange < -15 ? '🚨' : 
                 regressionData.percentChange < -10 ? '⚠️' : '📉';
    
    const scoreChangeText = `${regressionData.previousScore.toFixed(1)} → ${regressionData.currentScore.toFixed(1)} (${regressionData.percentChange.toFixed(1)}%)`;
    
    // Create the message object
    const message = {
      username: config.username || 'PersRM UX Monitor',
      icon_emoji: config.iconEmoji || ':chart_with_downwards_trend:',
      channel: config.channel,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} UX Regression Detected: ${regressionData.component}`,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `A significant UX regression was detected in *${regressionData.component}*${regressionData.project ? ` (${regressionData.project})` : ''}.`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Score Change:*\n${scoreChangeText}`
            },
            {
              type: 'mrkdwn',
              text: `*Date:*\n${date}`
            },
            {
              type: 'mrkdwn',
              text: `*New Issues:*\n${regressionData.newIssues}`
            }
          ]
        }
      ]
    };
    
    // Add affected phases section if there are any
    if (regressionData.affectedPhases.length > 0) {
      // Sort phases by delta (most negative first)
      const sortedPhases = [...regressionData.affectedPhases].sort((a, b) => a.delta - b.delta);
      
      const phaseText = sortedPhases.map(phase => 
        `• *${phase.name}*: ${phase.delta.toFixed(1)} points`
      ).join('\n');
      
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Affected Phases:*\n${phaseText}`
        }
      });
    }
    
    // Add report link if available
    if (regressionData.reportUrl) {
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<${regressionData.reportUrl}|View Full Report>`
        }
      });
    }
    
    // Add divider
    message.blocks.push({
      type: 'divider'
    });
    
    // Send the message to Slack
    await axios.post(config.webhookUrl, message);
    
    return true;
  } catch (error) {
    console.error(chalk.red(`Error sending regression alert to Slack: ${error.message}`));
    return false;
  }
}

/**
 * Send AI insights to Slack
 * @param insights AI generated insights
 * @returns Promise<boolean> Success status
 */
export async function sendAIInsights(insights: {
  component: string;
  title: string;
  summary: string;
  recommendations: string[];
  reportUrl?: string;
}): Promise<boolean> {
  try {
    const config = getSlackConfig();
    
    if (!config || !config.enabled || !config.webhookUrl) {
      console.log(chalk.yellow('Slack integration not configured or disabled'));
      return false;
    }
    
    // Create the message object
    const message = {
      username: config.username || 'PersRM UX Assistant',
      icon_emoji: config.iconEmoji || ':bulb:',
      channel: config.channel,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `💡 ${insights.title}`,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Component:* ${insights.component}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: insights.summary
          }
        }
      ]
    };
    
    // Add recommendations if available
    if (insights.recommendations && insights.recommendations.length > 0) {
      const recommendationsText = insights.recommendations
        .map((rec, index) => `${index + 1}. ${rec}`)
        .join('\n');
      
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Recommendations:*\n${recommendationsText}`
        }
      });
    }
    
    // Add report link if available
    if (insights.reportUrl) {
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<${insights.reportUrl}|View Full Report>`
        }
      });
    }
    
    // Add divider
    message.blocks.push({
      type: 'divider'
    });
    
    // Send the message to Slack
    await axios.post(config.webhookUrl, message);
    
    return true;
  } catch (error) {
    console.error(chalk.red(`Error sending AI insights to Slack: ${error.message}`));
    return false;
  }
}

// Export wrapper functions for external use
export const sendRegressionAlertToSlack = sendRegressionAlert;
export const sendAIInsightsToSlack = sendAIInsights; 