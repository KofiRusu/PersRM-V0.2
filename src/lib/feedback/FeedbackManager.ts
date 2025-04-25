import fs from 'fs-extra';
import path from 'path';
import { UXIssue, PhaseType, SeverityLevel } from '../persrm/types';
import { v4 as uuidv4 } from 'uuid';

export interface UserFeedback {
  id: string;
  componentId: string;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  type: 'error' | 'confusion' | 'satisfaction' | 'performance' | 'accessibility';
  message: string;
  context?: Record<string, any>;
  screenshot?: string; // Base64 encoded or path
  stackTrace?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface FeedbackSnapshot {
  id: string;
  timestamp: string;
  componentId: string;
  feedbackCount: number;
  errorCount: number;
  confusionCount: number;
  satisfactionCount: number;
  feedbackItems: UserFeedback[];
  generatedIssues: UXIssue[];
}

export interface FeedbackManagerOptions {
  storageDir: string;
  collectAutomatically?: boolean;
  errorTracking?: boolean;
  userSessions?: boolean;
  heatmaps?: boolean;
  verboseLogging?: boolean;
}

export class FeedbackManager {
  private options: FeedbackManagerOptions;
  private feedbackItems: UserFeedback[] = [];
  private feedbackMap: Map<string, UserFeedback[]> = new Map();
  private snapshots: FeedbackSnapshot[] = [];
  private errorHandler: ((error: Error) => void) | null = null;
  
  constructor(options: FeedbackManagerOptions) {
    this.options = {
      collectAutomatically: true,
      errorTracking: true,
      userSessions: false,
      heatmaps: false,
      verboseLogging: false,
      ...options
    };
    
    this.loadFeedback();
    
    if (this.options.collectAutomatically && this.options.errorTracking) {
      this.setupErrorTracking();
    }
  }
  
  /**
   * Load saved feedback from disk
   */
  private loadFeedback(): void {
    try {
      const feedbackPath = path.join(this.options.storageDir, 'feedback.json');
      const snapshotsPath = path.join(this.options.storageDir, 'feedback-snapshots.json');
      
      if (fs.existsSync(feedbackPath)) {
        this.feedbackItems = fs.readJSONSync(feedbackPath);
        
        // Rebuild the map
        this.feedbackMap.clear();
        for (const item of this.feedbackItems) {
          if (!this.feedbackMap.has(item.componentId)) {
            this.feedbackMap.set(item.componentId, []);
          }
          this.feedbackMap.get(item.componentId).push(item);
        }
      }
      
      if (fs.existsSync(snapshotsPath)) {
        this.snapshots = fs.readJSONSync(snapshotsPath);
      }
      
      if (this.options.verboseLogging) {
        console.log(`Loaded ${this.feedbackItems.length} feedback items and ${this.snapshots.length} snapshots.`);
      }
    } catch (error) {
      console.error('Error loading feedback data:', error);
    }
  }
  
  /**
   * Save feedback to disk
   */
  private saveFeedback(): void {
    try {
      fs.ensureDirSync(this.options.storageDir);
      
      const feedbackPath = path.join(this.options.storageDir, 'feedback.json');
      const snapshotsPath = path.join(this.options.storageDir, 'feedback-snapshots.json');
      
      fs.writeJSONSync(feedbackPath, this.feedbackItems, { spaces: 2 });
      fs.writeJSONSync(snapshotsPath, this.snapshots, { spaces: 2 });
      
      if (this.options.verboseLogging) {
        console.log('Feedback data saved successfully.');
      }
    } catch (error) {
      console.error('Error saving feedback data:', error);
    }
  }
  
  /**
   * Set up global error tracking
   */
  private setupErrorTracking(): void {
    // This would be implemented differently based on the environment (browser vs. Node)
    // For demonstration, we'll just set up a simple error handler
    this.errorHandler = (error: Error) => {
      const feedback: UserFeedback = {
        id: uuidv4(),
        componentId: 'unknown', // In a real impl, we would try to determine the component
        timestamp: new Date().toISOString(),
        type: 'error',
        message: error.message,
        stackTrace: error.stack,
        priority: 'high'
      };
      
      this.addFeedback(feedback);
    };
    
    // In browser, would do: window.addEventListener('error', handleError)
    process.on('uncaughtException', this.errorHandler);
  }
  
  /**
   * Add a new user feedback item
   */
  public addFeedback(feedback: Omit<UserFeedback, 'id' | 'timestamp'>): UserFeedback {
    const newFeedback: UserFeedback = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...feedback
    };
    
    this.feedbackItems.push(newFeedback);
    
    // Add to the component map
    if (!this.feedbackMap.has(newFeedback.componentId)) {
      this.feedbackMap.set(newFeedback.componentId, []);
    }
    this.feedbackMap.get(newFeedback.componentId).push(newFeedback);
    
    this.saveFeedback();
    
    if (this.options.verboseLogging) {
      console.log(`Added new feedback item for component ${newFeedback.componentId}`);
    }
    
    return newFeedback;
  }
  
  /**
   * Get all feedback for a specific component
   */
  public getFeedbackForComponent(componentId: string): UserFeedback[] {
    return this.feedbackMap.get(componentId) || [];
  }
  
  /**
   * Create a snapshot of feedback for a component
   */
  public createSnapshot(componentId: string): FeedbackSnapshot {
    const feedbackItems = this.getFeedbackForComponent(componentId);
    
    // Count different types
    const errorCount = feedbackItems.filter(f => f.type === 'error').length;
    const confusionCount = feedbackItems.filter(f => f.type === 'confusion').length;
    const satisfactionCount = feedbackItems.filter(f => f.type === 'satisfaction').length;
    
    // Generate issues based on feedback
    const generatedIssues = this.generateIssuesFromFeedback(feedbackItems);
    
    const snapshot: FeedbackSnapshot = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      componentId,
      feedbackCount: feedbackItems.length,
      errorCount,
      confusionCount,
      satisfactionCount,
      feedbackItems,
      generatedIssues
    };
    
    this.snapshots.push(snapshot);
    this.saveFeedback();
    
    return snapshot;
  }
  
  /**
   * Get all snapshots for a component
   */
  public getSnapshotsForComponent(componentId: string): FeedbackSnapshot[] {
    return this.snapshots.filter(s => s.componentId === componentId);
  }
  
  /**
   * Generate UX issues from feedback items
   */
  private generateIssuesFromFeedback(feedbackItems: UserFeedback[]): UXIssue[] {
    const issues: UXIssue[] = [];
    
    // Group feedback by type for analysis
    const byType = new Map<string, UserFeedback[]>();
    for (const item of feedbackItems) {
      if (!byType.has(item.type)) {
        byType.set(item.type, []);
      }
      byType.get(item.type).push(item);
    }
    
    // Generate issues for errors
    if (byType.has('error') && byType.get('error').length > 0) {
      const errorFeedback = byType.get('error');
      
      // Group similar errors
      const errorGroups = this.groupSimilarFeedback(errorFeedback);
      
      for (const [errorMessage, group] of errorGroups) {
        if (group.length > 1) {
          // This is a repeated error, likely more severe
          issues.push({
            id: uuidv4(),
            component: group[0].componentId,
            phase: PhaseType.RESPONSIVENESS, // Most errors are likely related to responsiveness issues
            message: `Recurring error: ${errorMessage}`,
            location: {
              file: `${group[0].componentId}.tsx`, // This would be more specific in a real implementation
              line: 0 // We don't have line information here
            },
            severity: SeverityLevel.ERROR,
            impact: 'High',
            suggestion: 'Implement proper error handling and validate inputs to prevent this recurring error'
          });
        } else {
          // Single occurrence error
          issues.push({
            id: uuidv4(),
            component: group[0].componentId,
            phase: PhaseType.RESPONSIVENESS,
            message: `Error encountered: ${errorMessage}`,
            location: {
              file: `${group[0].componentId}.tsx`,
              line: 0
            },
            severity: SeverityLevel.WARNING,
            impact: 'Medium',
            suggestion: 'Add error handling for this specific case'
          });
        }
      }
    }
    
    // Generate issues for confusion feedback
    if (byType.has('confusion') && byType.get('confusion').length > 0) {
      const confusionFeedback = byType.get('confusion');
      
      // If there are multiple confusion reports, this is likely a UX issue
      if (confusionFeedback.length >= 2) {
        issues.push({
          id: uuidv4(),
          component: confusionFeedback[0].componentId,
          phase: PhaseType.VISUAL_CONSISTENCY, // Confusion often relates to visual/UX design
          message: `Users report confusion with this component (${confusionFeedback.length} reports)`,
          location: {
            file: `${confusionFeedback[0].componentId}.tsx`,
            line: 0
          },
          severity: SeverityLevel.WARNING,
          impact: 'Medium',
          suggestion: 'Review the component UX design and consider usability testing'
        });
      }
    }
    
    // Generate issues for accessibility feedback
    if (byType.has('accessibility') && byType.get('accessibility').length > 0) {
      const accessibilityFeedback = byType.get('accessibility');
      
      issues.push({
        id: uuidv4(),
        component: accessibilityFeedback[0].componentId,
        phase: PhaseType.ACCESSIBILITY,
        message: `Accessibility issues reported (${accessibilityFeedback.length} reports)`,
        location: {
          file: `${accessibilityFeedback[0].componentId}.tsx`,
          line: 0
        },
        severity: SeverityLevel.ERROR, // Accessibility issues are typically high priority
        impact: 'High',
        suggestion: 'Ensure the component meets WCAG standards and implement proper ARIA attributes'
      });
    }
    
    // Generate issues for performance feedback
    if (byType.has('performance') && byType.get('performance').length > 0) {
      const performanceFeedback = byType.get('performance');
      
      issues.push({
        id: uuidv4(),
        component: performanceFeedback[0].componentId,
        phase: PhaseType.LOAD_TIME,
        message: `Performance issues reported (${performanceFeedback.length} reports)`,
        location: {
          file: `${performanceFeedback[0].componentId}.tsx`,
          line: 0
        },
        severity: SeverityLevel.WARNING,
        impact: 'Medium',
        suggestion: 'Optimize rendering and data loading, consider implementing memoization'
      });
    }
    
    return issues;
  }
  
  /**
   * Group similar feedback items based on message similarity
   */
  private groupSimilarFeedback(feedbackItems: UserFeedback[]): Map<string, UserFeedback[]> {
    const groups = new Map<string, UserFeedback[]>();
    
    for (const item of feedbackItems) {
      let found = false;
      
      // Very simple grouping strategy based on message similarity
      // A real implementation would use more sophisticated NLP/similarity metrics
      for (const [key, group] of groups.entries()) {
        if (this.isSimilarMessage(item.message, key)) {
          group.push(item);
          found = true;
          break;
        }
      }
      
      if (!found) {
        groups.set(item.message, [item]);
      }
    }
    
    return groups;
  }
  
  /**
   * Simple string similarity check
   * In a real implementation, this would be more sophisticated
   */
  private isSimilarMessage(message1: string, message2: string): boolean {
    if (message1 === message2) return true;
    
    // Check if one is a substring of the other
    if (message1.includes(message2) || message2.includes(message1)) return true;
    
    // Check for common words (very basic implementation)
    const words1 = new Set(message1.toLowerCase().split(/\s+/));
    const words2 = new Set(message2.toLowerCase().split(/\s+/));
    
    let commonCount = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        commonCount++;
      }
    }
    
    // If more than 50% of words match, consider them similar
    return commonCount > 0 && commonCount / Math.min(words1.size, words2.size) > 0.5;
  }
  
  /**
   * Generate a report of feedback trends
   */
  public generateFeedbackReport(componentId?: string): Record<string, any> {
    const relevantFeedback = componentId 
      ? this.getFeedbackForComponent(componentId)
      : this.feedbackItems;
    
    const relevantSnapshots = componentId
      ? this.getSnapshotsForComponent(componentId)
      : this.snapshots;
    
    // Count feedback by type
    const feedbackByType = {
      error: 0,
      confusion: 0,
      satisfaction: 0,
      performance: 0,
      accessibility: 0
    };
    
    for (const item of relevantFeedback) {
      feedbackByType[item.type] += 1;
    }
    
    // Group feedback by component
    const feedbackByComponent = new Map<string, number>();
    for (const item of relevantFeedback) {
      feedbackByComponent.set(
        item.componentId, 
        (feedbackByComponent.get(item.componentId) || 0) + 1
      );
    }
    
    // Convert to array and sort by count
    const componentRanking = Array.from(feedbackByComponent.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);
    
    // Calculate trends over time
    const feedbackOverTime = this.calculateFeedbackOverTime(relevantFeedback);
    
    return {
      totalFeedback: relevantFeedback.length,
      feedbackByType,
      componentRanking,
      feedbackOverTime,
      mostRecentSnapshot: relevantSnapshots.length > 0 
        ? relevantSnapshots[relevantSnapshots.length - 1] 
        : null,
      snapshotsCount: relevantSnapshots.length
    };
  }
  
  /**
   * Calculate feedback trends over time
   */
  private calculateFeedbackOverTime(feedback: UserFeedback[]): Record<string, number> {
    const result: Record<string, number> = {};
    
    // Group by day
    for (const item of feedback) {
      const date = new Date(item.timestamp).toISOString().split('T')[0];
      
      if (!result[date]) {
        result[date] = 0;
      }
      
      result[date] += 1;
    }
    
    return result;
  }
  
  /**
   * Simulate user feedback for testing and development
   */
  public simulateFeedback(
    componentId: string, 
    count: number = 10,
    distribution: Record<string, number> = {
      error: 0.2,
      confusion: 0.3,
      satisfaction: 0.2,
      performance: 0.2,
      accessibility: 0.1
    }
  ): UserFeedback[] {
    const simulatedFeedback: UserFeedback[] = [];
    
    const types: ('error' | 'confusion' | 'satisfaction' | 'performance' | 'accessibility')[] = [
      'error', 'confusion', 'satisfaction', 'performance', 'accessibility'
    ];
    
    const errorMessages = [
      'Cannot read property of undefined',
      'Failed to fetch data',
      'Timeout exceeded',
      'Invalid input format',
      'Maximum update depth exceeded'
    ];
    
    const confusionMessages = [
      'I don\'t understand how to use this',
      'The layout is confusing',
      'Unclear what this button does',
      'Can\'t find where to click',
      'Instructions are unclear'
    ];
    
    const satisfactionMessages = [
      'Works great!',
      'Easy to use',
      'Love the design',
      'Very intuitive',
      'Helpful feature'
    ];
    
    const performanceMessages = [
      'Page freezes when I click',
      'Takes too long to load',
      'Laggy interface',
      'Slow response time',
      'Animation stutters'
    ];
    
    const accessibilityMessages = [
      'Can\'t read the text, contrast too low',
      'No keyboard navigation',
      'Screen reader doesn\'t announce content',
      'Buttons too small to click',
      'Color scheme issues for colorblind users'
    ];
    
    const messageMap = {
      error: errorMessages,
      confusion: confusionMessages,
      satisfaction: satisfactionMessages,
      performance: performanceMessages,
      accessibility: accessibilityMessages
    };
    
    for (let i = 0; i < count; i++) {
      // Choose feedback type based on distribution
      const rand = Math.random();
      let cumulativeProbability = 0;
      let selectedType = types[0];
      
      for (const type of types) {
        cumulativeProbability += distribution[type] || 0;
        if (rand < cumulativeProbability) {
          selectedType = type;
          break;
        }
      }
      
      // Get random message for the selected type
      const messages = messageMap[selectedType];
      const message = messages[Math.floor(Math.random() * messages.length)];
      
      // Create timestamp with random offset from now (up to 30 days in the past)
      const timestamp = new Date(
        Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)
      ).toISOString();
      
      const feedback: UserFeedback = {
        id: uuidv4(),
        componentId,
        timestamp,
        type: selectedType,
        message,
        userId: `user-${Math.floor(Math.random() * 100)}`,
        sessionId: `session-${Math.floor(Math.random() * 1000)}`,
        priority: selectedType === 'error' ? 'high' : 
                  selectedType === 'accessibility' ? 'medium' : 'low'
      };
      
      simulatedFeedback.push(feedback);
      this.feedbackItems.push(feedback);
      
      // Add to the component map
      if (!this.feedbackMap.has(componentId)) {
        this.feedbackMap.set(componentId, []);
      }
      this.feedbackMap.get(componentId).push(feedback);
    }
    
    // Sort by timestamp
    this.feedbackItems.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    this.saveFeedback();
    
    if (this.options.verboseLogging) {
      console.log(`Simulated ${count} feedback items for component ${componentId}`);
    }
    
    return simulatedFeedback;
  }
  
  /**
   * Clean up when the manager is no longer needed
   */
  public dispose(): void {
    // Remove error handler if it was set up
    if (this.errorHandler) {
      process.removeListener('uncaughtException', this.errorHandler);
    }
    
    // Save any pending feedback
    this.saveFeedback();
    
    if (this.options.verboseLogging) {
      console.log('FeedbackManager disposed.');
    }
  }
} 