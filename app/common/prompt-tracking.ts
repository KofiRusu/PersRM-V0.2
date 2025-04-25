import { retentionService } from './retention';

export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  description: string;
  category: string;
  version: number;
  createdAt: Date;
}

export interface PromptExecution {
  id: string;
  promptTemplateId: string;
  input: Record<string, any>;
  output: string;
  success: boolean | null;
  feedback?: 'positive' | 'neutral' | 'negative';
  feedbackDetails?: string;
  executionTime: number; // in ms
  executedAt: Date;
}

export interface PromptMetrics {
  templateId: string;
  successRate: number;
  totalExecutions: number;
  averageExecutionTime: number;
  feedbackCounts: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

class PromptTrackingService {
  private promptTemplates: Map<string, PromptTemplate> = new Map();
  private executions: PromptExecution[] = [];
  private apiEndpoint: string | null = null;
  
  /**
   * Configure the service with an API endpoint
   */
  public configure(apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint;
  }
  
  /**
   * Register a prompt template for tracking
   */
  public registerPromptTemplate(template: Omit<PromptTemplate, 'createdAt'>): PromptTemplate {
    const promptTemplate: PromptTemplate = {
      ...template,
      createdAt: new Date(),
    };
    
    this.promptTemplates.set(promptTemplate.id, promptTemplate);
    
    // Log template registration
    retentionService.trackEvent('prompt-template-registered', {
      templateId: promptTemplate.id,
      name: promptTemplate.name,
      category: promptTemplate.category,
      version: promptTemplate.version,
    });
    
    return promptTemplate;
  }
  
  /**
   * Track the execution of a prompt
   */
  public trackExecution(
    templateId: string,
    input: Record<string, any>,
    output: string,
    executionTime: number
  ): PromptExecution {
    const template = this.promptTemplates.get(templateId);
    
    if (!template) {
      throw new Error(`Prompt template with ID ${templateId} not found. Register it first.`);
    }
    
    const execution: PromptExecution = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      promptTemplateId: templateId,
      input,
      output,
      success: null, // Will be set later with feedback
      executionTime,
      executedAt: new Date(),
    };
    
    this.executions.push(execution);
    
    // Log execution
    retentionService.trackEvent('prompt-executed', {
      executionId: execution.id,
      templateId,
      templateName: template.name,
      category: template.category,
      executionTime,
    });
    
    // Send to API if configured
    this.sendExecutionToAPI(execution);
    
    return execution;
  }
  
  /**
   * Record feedback for a prompt execution
   */
  public recordFeedback(
    executionId: string,
    feedback: 'positive' | 'neutral' | 'negative',
    feedbackDetails?: string
  ): void {
    const executionIndex = this.executions.findIndex(e => e.id === executionId);
    
    if (executionIndex === -1) {
      throw new Error(`Execution with ID ${executionId} not found.`);
    }
    
    const execution = this.executions[executionIndex];
    execution.feedback = feedback;
    execution.feedbackDetails = feedbackDetails;
    
    // Set success based on feedback
    execution.success = feedback === 'positive';
    
    // Update in our local array
    this.executions[executionIndex] = execution;
    
    // Log feedback
    retentionService.trackEvent('prompt-feedback-recorded', {
      executionId,
      templateId: execution.promptTemplateId,
      feedback,
      feedbackDetails,
      success: execution.success,
    });
    
    // Send updated execution to API
    this.sendExecutionToAPI(execution);
  }
  
  /**
   * Calculate metrics for a prompt template
   */
  public calculateMetrics(templateId: string): PromptMetrics | null {
    const templateExecutions = this.executions.filter(e => e.promptTemplateId === templateId);
    
    if (!templateExecutions.length) {
      return null;
    }
    
    // Count successful executions (those with positive feedback)
    const successfulExecutions = templateExecutions.filter(e => e.success === true);
    
    // Count feedback types
    const feedbackCounts = {
      positive: templateExecutions.filter(e => e.feedback === 'positive').length,
      neutral: templateExecutions.filter(e => e.feedback === 'neutral').length,
      negative: templateExecutions.filter(e => e.feedback === 'negative').length,
    };
    
    // Calculate average execution time
    const totalExecutionTime = templateExecutions.reduce((sum, e) => sum + e.executionTime, 0);
    
    return {
      templateId,
      successRate: successfulExecutions.length / templateExecutions.length,
      totalExecutions: templateExecutions.length,
      averageExecutionTime: totalExecutionTime / templateExecutions.length,
      feedbackCounts,
    };
  }
  
  /**
   * Get top performing prompt templates by success rate
   */
  public getTopPerformingTemplates(limit: number = 10, category?: string): PromptMetrics[] {
    const metrics: PromptMetrics[] = [];
    
    // Calculate metrics for all templates
    for (const templateId of this.promptTemplates.keys()) {
      const template = this.promptTemplates.get(templateId)!;
      
      // Skip if category filter is applied and doesn't match
      if (category && template.category !== category) {
        continue;
      }
      
      const templateMetrics = this.calculateMetrics(templateId);
      if (templateMetrics) {
        metrics.push(templateMetrics);
      }
    }
    
    // Sort by success rate and return top N
    return metrics
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, limit);
  }
  
  /**
   * Get all registered prompt templates
   */
  public getPromptTemplates(): PromptTemplate[] {
    return Array.from(this.promptTemplates.values());
  }
  
  /**
   * Get executions for a template
   */
  public getExecutions(templateId?: string): PromptExecution[] {
    if (templateId) {
      return this.executions.filter(e => e.promptTemplateId === templateId);
    }
    return [...this.executions];
  }
  
  /**
   * Send execution data to API
   */
  private async sendExecutionToAPI(execution: PromptExecution): Promise<void> {
    if (!this.apiEndpoint) return;
    
    try {
      const response = await fetch(`${this.apiEndpoint}/prompt-executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(execution),
      });
      
      if (!response.ok) {
        console.error('Failed to send prompt execution data to API:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending prompt execution data to API:', error);
    }
  }
}

// Export singleton instance
export const promptTrackingService = new PromptTrackingService();
export default promptTrackingService; 