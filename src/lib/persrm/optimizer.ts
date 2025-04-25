import fs from 'fs-extra';
import path from 'path';
import { 
  PersRMConfig,
  AnalysisResult,
  OptimizationResult,
  UXIssue,
  EnhancementSuggestion,
  SeverityLevel,
  PhaseType
} from './types';

export class UXOptimizer {
  private config: PersRMConfig;
  
  constructor(config: PersRMConfig) {
    this.config = {
      verbose: false,
      outputPath: './reports',
      ...config
    };
  }

  public async optimize(
    componentPath: string, 
    analysisResult: AnalysisResult
  ): Promise<OptimizationResult> {
    if (!fs.existsSync(componentPath)) {
      throw new Error(`Component file does not exist: ${componentPath}`);
    }

    if (this.config.verbose) {
      console.log(`Optimizing component: ${analysisResult.componentId}`);
    }

    // Read component file
    const originalCode = await fs.readFile(componentPath, 'utf8');
    
    // Generate enhancement suggestions based on issues
    const suggestions = this.generateSuggestions(analysisResult);
    
    // Apply enhancements (mock implementation)
    const optimizedCode = this.applyEnhancements(originalCode, suggestions);
    
    // Create optimization result
    const result: OptimizationResult = {
      componentId: analysisResult.componentId,
      componentPath: componentPath,
      originalSize: originalCode.length,
      optimizedSize: optimizedCode.length,
      suggestions,
      timestamp: new Date().toISOString(),
      changes: [
        {
          type: 'performance',
          before: 'original code section',
          after: 'optimized code section',
          lineNumber: 45
        }
      ]
    };

    // Save optimized file if requested
    if (this.config.saveOptimized) {
      await this.saveOptimizedFile(componentPath, optimizedCode);
    }

    return result;
  }

  public async optimizeMultiple(
    analysisResults: AnalysisResult[]
  ): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];
    
    for (const analysis of analysisResults) {
      try {
        const result = await this.optimize(analysis.componentPath, analysis);
        results.push(result);
      } catch (error) {
        console.error(`Failed to optimize ${analysis.componentId}:`, error);
      }
    }
    
    return results;
  }

  public async saveOptimizedFile(
    originalPath: string, 
    optimizedCode: string
  ): Promise<void> {
    const dir = path.dirname(originalPath);
    const filename = path.basename(originalPath);
    const ext = path.extname(filename);
    const baseName = filename.substring(0, filename.length - ext.length);
    
    const optimizedPath = path.join(
      dir, 
      `${baseName}.optimized${ext}`
    );
    
    await fs.writeFile(optimizedPath, optimizedCode, 'utf8');
    
    if (this.config.verbose) {
      console.log(`Optimized file saved to: ${optimizedPath}`);
    }
  }

  private generateSuggestions(
    analysisResult: AnalysisResult
  ): EnhancementSuggestion[] {
    const { issues } = analysisResult.summary;
    
    return issues.map(issue => {
      // Convert issue to enhancement suggestion
      const suggestion: EnhancementSuggestion = {
        id: `suggestion-${issue.id}`,
        title: this.generateSuggestionTitle(issue),
        description: issue.suggestion || 'No specific suggestion available',
        impact: issue.impact || 'Unknown',
        complexity: this.estimateComplexity(issue),
        phase: issue.phase,
        location: issue.location,
        automated: this.canAutomate(issue)
      };
      
      return suggestion;
    });
  }

  private generateSuggestionTitle(issue: UXIssue): string {
    const actionMap: Record<PhaseType, string> = {
      [PhaseType.LOAD_TIME]: 'Improve load time',
      [PhaseType.RESPONSIVENESS]: 'Enhance responsiveness',
      [PhaseType.VISUAL_CONSISTENCY]: 'Fix visual consistency',
      [PhaseType.ANIMATIONS]: 'Optimize animations', 
      [PhaseType.ACCESSIBILITY]: 'Improve accessibility',
      [PhaseType.DESIGN_TOKENS]: 'Standardize design tokens'
    };
    
    return `${actionMap[issue.phase] || 'Fix issue'} in ${issue.component}`;
  }

  private estimateComplexity(issue: UXIssue): string {
    // Estimate complexity based on severity and other factors
    switch (issue.severity) {
      case SeverityLevel.CRITICAL:
        return 'High';
      case SeverityLevel.ERROR:
        return 'Medium';
      default:
        return 'Low';
    }
  }

  private canAutomate(issue: UXIssue): boolean {
    // Determine if the suggestion can be automated
    // For demonstration, let's say only certain phases can be automated
    const automatedPhases = [
      PhaseType.LOAD_TIME,
      PhaseType.DESIGN_TOKENS,
      PhaseType.VISUAL_CONSISTENCY
    ];
    
    return automatedPhases.includes(issue.phase) && 
           issue.severity !== SeverityLevel.CRITICAL;
  }

  private applyEnhancements(
    code: string, 
    suggestions: EnhancementSuggestion[]
  ): string {
    // Mock implementation - in a real scenario, this would apply actual code transformations
    let optimizedCode = code;
    
    // For demonstration, we'll just add comments about the optimizations
    const automatedSuggestions = suggestions.filter(s => s.automated);
    
    if (automatedSuggestions.length > 0) {
      const enhancementComments = automatedSuggestions
        .map(s => `// PersRM Enhancement: ${s.title}\n// ${s.description}\n`)
        .join('');
      
      optimizedCode = enhancementComments + optimizedCode;
    }
    
    return optimizedCode;
  }
} 