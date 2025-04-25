import { EventEmitter } from 'events';
import { 
  PhaseType, 
  SeverityLevel, 
  EnhancementSummary, 
  UXScoreProgress, 
  Issue, 
  PhaseResult,
  ReportConfig,
  ReportFormat
} from './types';

// Singleton engine class for handling UI enhancements
class UXEnhancerEngineClass extends EventEmitter {
  private isAnalyzing: boolean = false;
  private currentPhase: PhaseType | null = null;
  private analysisAborted: boolean = false;
  private analysisPromise: Promise<EnhancementSummary> | null = null;

  constructor() {
    super();
    this.setMaxListeners(50); // Increase max listeners to avoid warnings
  }

  // Start analysis for a specific plugin
  async startAnalysis(pluginId: string): Promise<EnhancementSummary> {
    if (this.isAnalyzing) {
      throw new Error('Analysis already in progress');
    }

    this.isAnalyzing = true;
    this.analysisAborted = false;

    try {
      this.analysisPromise = this.runAnalysis(pluginId);
      return await this.analysisPromise;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during analysis';
      this.emit('analysisError', errorMessage);
      throw error;
    } finally {
      this.isAnalyzing = false;
      this.currentPhase = null;
      this.analysisPromise = null;
    }
  }

  // Cancel ongoing analysis
  cancelAnalysis(): void {
    if (!this.isAnalyzing) return;

    this.analysisAborted = true;
    this.emit('analysisError', 'Analysis canceled by user');
    this.isAnalyzing = false;
    this.currentPhase = null;
  }

  // Generate report from analysis results
  async generateReport(summary: EnhancementSummary, config: ReportConfig): Promise<string> {
    try {
      // In a real implementation, this would call a backend API endpoint
      // For now, we'll simulate report generation
      
      const { format, includeScreenshots, detailLevel } = config;
      
      let filePath = '';
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      
      // Simulate file path generation based on format
      switch (format) {
        case ReportFormat.PDF:
          filePath = `ux-report-${summary.pluginId}-${timestamp}.pdf`;
          break;
        case ReportFormat.HTML:
          filePath = `ux-report-${summary.pluginId}-${timestamp}.html`;
          break;
        case ReportFormat.JSON:
          filePath = `ux-report-${summary.pluginId}-${timestamp}.json`;
          break;
        case ReportFormat.CSV:
          filePath = `ux-report-${summary.pluginId}-${timestamp}.csv`;
          break;
      }
      
      // Simulate download by triggering a download link click
      // In a real implementation, this would be handled by the backend
      const downloadLink = document.createElement('a');
      downloadLink.href = `/api/reports/${filePath}`;
      downloadLink.download = filePath;
      downloadLink.click();
      
      return filePath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error generating report';
      throw new Error(errorMessage);
    }
  }

  // Private methods
  private async runAnalysis(pluginId: string): Promise<EnhancementSummary> {
    const phases = Object.values(PhaseType);
    const phaseResults: Record<PhaseType, PhaseResult> = {} as Record<PhaseType, PhaseResult>;
    
    for (const phase of phases) {
      if (this.analysisAborted) {
        throw new Error('Analysis was aborted');
      }
      
      this.currentPhase = phase;
      this.emit('phaseStart', phase);
      
      try {
        const result = await this.analyzePhase(phase, pluginId);
        phaseResults[phase] = result;
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? `Error in ${phase} phase: ${error.message}` 
          : `Unknown error in ${phase} phase`;
        this.emit('analysisError', errorMessage);
        throw error;
      }
    }
    
    const overallScore = this.calculateOverallScore(phaseResults);
    
    const summary: EnhancementSummary = {
      pluginId,
      overallScore,
      phases: phaseResults,
      timestamp: new Date().toISOString()
    };
    
    this.emit('analysisComplete', summary);
    return summary;
  }

  private async analyzePhase(phase: PhaseType, pluginId: string): Promise<PhaseResult> {
    // This would call actual analysis logic in a real implementation
    // For demo purposes, we'll simulate the analysis with delays and mock data
    
    const totalSteps = 10;
    for (let i = 0; i < totalSteps; i++) {
      if (this.analysisAborted) {
        throw new Error('Analysis was aborted');
      }
      
      // Update progress
      const progress: UXScoreProgress = {
        completed: i + 1,
        total: totalSteps,
        percentage: Math.round(((i + 1) / totalSteps) * 100)
      };
      
      this.emit('phaseProgress', progress);
      
      // Simulate work with delay
      await this.delay(300);
    }
    
    // Generate mock results for this phase
    return this.generateMockPhaseResult(phase);
  }

  private calculateOverallScore(phaseResults: Record<PhaseType, PhaseResult>): number {
    const phases = Object.values(PhaseType);
    const sum = phases.reduce((acc, phase) => acc + phaseResults[phase].score, 0);
    return Math.round(sum / phases.length);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Mock data generation for demo purposes
  private generateMockPhaseResult(phase: PhaseType): PhaseResult {
    const score = Math.floor(Math.random() * 30) + 70; // 70-100 score
    const issueCount = Math.floor(Math.random() * 3) + 1; // 1-3 issues
    
    return {
      score,
      issues: Array.from({ length: issueCount }, (_, i) => this.generateMockIssue(phase, i)),
      timestamp: new Date().toISOString()
    };
  }

  private generateMockIssue(phase: PhaseType, index: number): Issue {
    const severityLevels = Object.values(SeverityLevel);
    const severity = severityLevels[Math.floor(Math.random() * severityLevels.length)];
    
    // Define issue templates for each phase
    const issueTemplates = {
      [PhaseType.VISUAL]: [
        {
          title: 'Color contrast issues',
          description: 'Some text elements have insufficient color contrast.',
          recommendations: ['Increase contrast ratio to at least 4.5:1 for normal text']
        },
        {
          title: 'Inconsistent visual hierarchy',
          description: 'UI elements lack clear visual hierarchy.',
          recommendations: ['Use size, weight, and color to establish clear visual hierarchy']
        }
      ],
      [PhaseType.DESIGN]: [
        {
          title: 'Complex navigation structure',
          description: 'The navigation structure is overly complex.',
          recommendations: ['Simplify navigation to 2-3 levels maximum']
        },
        {
          title: 'Form validation feedback is delayed',
          description: 'Users are only notified of input errors after submitting the form.',
          recommendations: ['Implement inline validation as users type']
        }
      ],
      [PhaseType.ANIMATION]: [
        {
          title: 'Animation duration too long',
          description: 'Transitions between states take too long.',
          recommendations: ['Keep animations between 200-300ms for optimal feel']
        },
        {
          title: 'Animations don\'t respect user preferences',
          description: 'Animations continue to play even when users have "prefers-reduced-motion" enabled.',
          recommendations: ['Respect prefers-reduced-motion media query']
        }
      ],
      [PhaseType.COGNITIVE]: [
        {
          title: 'High cognitive load',
          description: 'Some screens present too much information at once.',
          recommendations: ['Break complex tasks into smaller steps']
        },
        {
          title: 'Unclear error messages',
          description: 'Error messages are technical and don\'t provide clear guidance.',
          recommendations: ['Use plain language for error messages']
        }
      ]
    };
    
    const template = issueTemplates[phase][index % issueTemplates[phase].length];
    
    return {
      id: `${phase}-issue-${index}`,
      title: template.title,
      description: template.description,
      severity,
      recommendations: template.recommendations,
      screenshot: Math.random() > 0.5 ? `https://picsum.photos/seed/${phase}${index}/400/300` : undefined
    };
  }
}

// Export as singleton
export const UXEnhancerEngine = new UXEnhancerEngineClass(); 