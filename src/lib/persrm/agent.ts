import path from 'path';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { 
  PersRMConfig, 
  AgentMode, 
  AnalysisResult, 
  EnhancementSuggestion,
  UXEnhancementSummary,
  UXIssue,
  OptimizationResult,
  GeneratedComponent,
  ComponentGenerationOptions,
  ReportOptions,
  AgentResult,
  PhaseType,
  ValidationResult,
  ComponentGenerationResult,
  ProjectScanResult
} from './types';
import { VisualAnalyzer } from '../analyzers/visual-analyzer';
import { DesignTokenAnalyzer } from '../analyzers/design-token-analyzer';
import { AnimationPerformanceTracker } from '../analyzers/animation-performance-tracker';
import { CognitiveLoadSimulator } from '../analyzers/cognitive-load-simulator';
import { AccessibilityAnalyzer } from '../analyzers/accessibility-analyzer';
import { ComponentGenerator } from '../generators/component-generator';
import { ReportGenerator } from '../generators/report-generator';
import { validateEnhancementSummary } from '../ux-enhancer/validation';
import { logger } from '../utils/logger';
import { ProjectScanner } from '../project-scanner';
import { CIIntegration } from '../ci-integration';
import glob from 'glob';

export class PersRMAgent {
  private config: PersRMConfig;
  private visualAnalyzer: VisualAnalyzer;
  private designTokenAnalyzer: DesignTokenAnalyzer;
  private animationTracker: AnimationPerformanceTracker;
  private cognitiveLoadSimulator: CognitiveLoadSimulator;
  private accessibilityAnalyzer: AccessibilityAnalyzer;
  private componentGenerator: ComponentGenerator;
  private reportGenerator: ReportGenerator;
  private projectScanner: ProjectScanner;
  private ciIntegration: CIIntegration;
  private results: AnalysisResult[] = [];

  constructor(config: PersRMConfig) {
    this.config = this.validateAndNormalizeConfig(config);
    this.initializeOutputDirectory();
    
    // Initialize analyzers and generators
    this.visualAnalyzer = new VisualAnalyzer(this.config);
    this.designTokenAnalyzer = new DesignTokenAnalyzer(this.config);
    this.animationTracker = new AnimationPerformanceTracker(this.config);
    this.cognitiveLoadSimulator = new CognitiveLoadSimulator(this.config);
    this.accessibilityAnalyzer = new AccessibilityAnalyzer(this.config);
    this.componentGenerator = new ComponentGenerator(this.config);
    this.reportGenerator = new ReportGenerator(this.config);
    this.projectScanner = new ProjectScanner();
    this.ciIntegration = new CIIntegration();
    
    logger.info('PersRM Agent initialized with mode:', this.config.mode);
  }

  private validateAndNormalizeConfig(config: PersRMConfig): PersRMConfig {
    // Ensure project path exists
    if (!fs.existsSync(config.projectPath)) {
      throw new Error(`Project path does not exist: ${config.projectPath}`);
    }

    // Ensure output directory is absolute
    const outputDir = path.isAbsolute(config.outputDir) 
      ? config.outputDir 
      : path.join(process.cwd(), config.outputDir);

    return {
      ...config,
      outputDir,
      designSystemPath: config.designSystemPath 
        ? (path.isAbsolute(config.designSystemPath) 
            ? config.designSystemPath 
            : path.join(process.cwd(), config.designSystemPath))
        : undefined
    };
  }

  private initializeOutputDirectory(): void {
    fs.ensureDirSync(this.config.outputDir);
    logger.info(`Output directory initialized: ${this.config.outputDir}`);
  }

  private async analyzeComponents(): Promise<AnalysisResult[]> {
    logger.info('Starting component analysis...');
    
    // Find components to analyze
    const componentPaths = await this.findComponentsToAnalyze();
    const results: AnalysisResult[] = [];
    
    for (const componentPath of componentPaths) {
      try {
        logger.info(`Analyzing component: ${componentPath}`);
        const component = path.basename(componentPath);
        
        // Perform different analyses
        const visualResults = await this.visualAnalyzer.analyze(componentPath);
        const designTokenResults = await this.designTokenAnalyzer.analyze(componentPath);
        const animationResults = await this.animationTracker.analyze(componentPath);
        const cognitiveLoadResults = await this.cognitiveLoadSimulator.analyze(componentPath);
        const accessibilityResults = await this.accessibilityAnalyzer.analyze(componentPath);
        
        // Combine issues from all analyses
        const allIssues: UXIssue[] = [
          ...visualResults.layoutIssues,
          ...(designTokenResults.tokenViolations.map(violation => ({
            id: uuidv4(),
            title: `Design token violation: ${violation.tokenType}`,
            description: `Expected ${violation.expected}, found ${violation.actual}`,
            severity: violation.impact,
            priority: this.determinePriority(violation.impact),
            phase: PhaseType.DESIGN_CONSISTENCY,
            component,
            element: violation.element
          }))),
          ...animationResults.performanceIssues,
          ...cognitiveLoadResults.issues,
          ...accessibilityResults.issues
        ];
        
        results.push({
          id: uuidv4(),
          timestamp: new Date(),
          component,
          visualResults,
          designTokenResults,
          animationResults,
          cognitiveLoadResults,
          accessibility: accessibilityResults,
          issues: allIssues
        });
        
        logger.info(`Completed analysis for: ${component} - Found ${allIssues.length} issues`);
      } catch (error) {
        logger.error(`Error analyzing component ${componentPath}:`, error);
      }
    }
    
    return results;
  }
  
  private determinePriority(severity: any): any {
    // Map severity to priority based on your business logic
    return severity; // Simple 1:1 mapping for now
  }
  
  private async findComponentsToAnalyze(): Promise<string[]> {
    // Implementation to find component files in the project
    // This is a simplified version - in practice, you might want to use glob or another method
    logger.info(`Searching for components in: ${this.config.projectPath}`);
    return await this.findFiles(this.config.projectPath, ['.jsx', '.tsx', '.vue', '.svelte']);
  }
  
  private async findFiles(dir: string, extensions: string[]): Promise<string[]> {
    const result: string[] = [];
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        const nestedFiles = await this.findFiles(filePath, extensions);
        result.push(...nestedFiles);
      } else if (extensions.some(ext => file.endsWith(ext))) {
        result.push(filePath);
      }
    }
    
    return result;
  }
  
  private generateSuggestions(analysisResults: AnalysisResult[]): EnhancementSuggestion[] {
    logger.info('Generating enhancement suggestions...');
    
    const suggestions: EnhancementSuggestion[] = [];
    
    for (const result of analysisResults) {
      for (const issue of result.issues) {
        // Generate a suggestion for each issue
        suggestions.push({
          id: uuidv4(),
          title: `Fix: ${issue.title}`,
          description: `Suggested improvement: ${issue.description}`,
          type: this.determineSuggestionType(issue),
          priority: issue.priority,
          issues: [issue.id],
          estimatedImpact: this.calculateEstimatedImpact(issue)
        });
      }
    }
    
    // Consolidate similar suggestions
    return this.consolidateSuggestions(suggestions);
  }
  
  private determineSuggestionType(issue: UXIssue): any {
    // Determine suggestion type based on the issue phase
    switch (issue.phase) {
      case PhaseType.DESIGN_CONSISTENCY:
        return 'DESIGN_TOKEN_UPDATE';
      case PhaseType.ANIMATION_PERFORMANCE:
        return 'ANIMATION_OPTIMIZATION';
      case PhaseType.ACCESSIBILITY:
        return 'ACCESSIBILITY_FIX';
      default:
        return 'CODE_CHANGE';
    }
  }
  
  private calculateEstimatedImpact(issue: UXIssue): number {
    // Calculate potential impact of fixing this issue (0-100)
    switch (issue.severity) {
      case 'CRITICAL':
        return 90;
      case 'ERROR':
        return 70;
      case 'WARNING':
        return 40;
      case 'INFO':
      default:
        return 20;
    }
  }
  
  private consolidateSuggestions(suggestions: EnhancementSuggestion[]): EnhancementSuggestion[] {
    // Group similar suggestions together
    const groupedSuggestions: Record<string, EnhancementSuggestion> = {};
    
    for (const suggestion of suggestions) {
      const key = `${suggestion.type}-${suggestion.priority}`;
      
      if (groupedSuggestions[key]) {
        // Merge this suggestion with an existing one
        groupedSuggestions[key].issues = [
          ...groupedSuggestions[key].issues,
          ...suggestion.issues
        ];
        
        // Take the max estimated impact
        if (suggestion.estimatedImpact > groupedSuggestions[key].estimatedImpact) {
          groupedSuggestions[key].estimatedImpact = suggestion.estimatedImpact;
        }
      } else {
        // Create a new group
        groupedSuggestions[key] = { ...suggestion };
      }
    }
    
    return Object.values(groupedSuggestions);
  }
  
  private generateSummary(analysisResults: AnalysisResult[], suggestions: EnhancementSuggestion[]): UXEnhancementSummary {
    logger.info('Generating enhancement summary...');
    
    // Calculate overall score based on all analysis results
    const phases: Record<PhaseType, any> = {} as Record<PhaseType, any>;
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    // Initialize phases
    Object.values(PhaseType).forEach(phase => {
      phases[phase] = {
        score: 0,
        maxScore: 100,
        issues: []
      };
    });
    
    // Populate phases with issues and calculate scores
    for (const result of analysisResults) {
      result.issues.forEach(issue => {
        phases[issue.phase].issues.push(issue.id);
        
        // Reduce score based on severity
        switch (issue.severity) {
          case 'CRITICAL':
            phases[issue.phase].score -= 30;
            break;
          case 'ERROR':
            phases[issue.phase].score -= 15;
            break;
          case 'WARNING':
            phases[issue.phase].score -= 5;
            break;
          case 'INFO':
            phases[issue.phase].score -= 1;
            break;
        }
      });
    }
    
    // Ensure no negative scores
    Object.keys(phases).forEach(phase => {
      phases[phase as PhaseType].score = Math.max(0, phases[phase as PhaseType].score);
      totalScore += phases[phase as PhaseType].score;
      maxPossibleScore += phases[phase as PhaseType].maxScore;
    });
    
    // Collect all issue IDs
    const allIssueIds = analysisResults.flatMap(result => result.issues.map(issue => issue.id));
    
    return {
      id: uuidv4(),
      appName: path.basename(this.config.projectPath),
      version: '1.0.0', // This should come from your project's package.json
      timestamp: new Date(),
      duration: 0, // This will be set later
      overallScore: totalScore,
      maxScore: maxPossibleScore,
      phases: phases as Record<PhaseType, any>,
      issues: allIssueIds
    };
  }
  
  private async generateComponents(suggestions: EnhancementSuggestion[]): Promise<GeneratedComponent[]> {
    logger.info('Generating components based on suggestions...');
    
    const componentsToGenerate: ComponentGenerationOptions[] = [];
    
    // Identify components that need to be generated
    suggestions.forEach(suggestion => {
      if (suggestion.type === 'COMPONENT_EXTRACTION') {
        componentsToGenerate.push({
          componentType: this.determineComponentType(suggestion),
          componentName: this.generateComponentName(suggestion)
        });
      }
    });
    
    const generatedComponents: GeneratedComponent[] = [];
    
    // Generate each component
    for (const options of componentsToGenerate) {
      try {
        const component = await this.componentGenerator.generate(options);
        generatedComponents.push(component);
      } catch (error) {
        logger.error(`Error generating component ${options.componentName}:`, error);
      }
    }
    
    return generatedComponents;
  }
  
  private determineComponentType(suggestion: EnhancementSuggestion): any {
    // You would have logic here to determine the appropriate component type
    return 'CUSTOM'; // Default
  }
  
  private generateComponentName(suggestion: EnhancementSuggestion): string {
    // Generate a sensible name based on the suggestion
    return `Extracted${Math.floor(Math.random() * 1000)}`;
  }
  
  private async generateReport(
    summary: UXEnhancementSummary, 
    suggestions: EnhancementSuggestion[],
    generatedComponents: GeneratedComponent[],
    options: ReportOptions
  ): Promise<string> {
    logger.info(`Generating ${options.format} report...`);
    
    const reportData = {
      summary,
      suggestions,
      generatedComponents
    };
    
    return await this.reportGenerator.generate(reportData, options);
  }
  
  private validateSummary(summary: UXEnhancementSummary): ValidationResult {
    return validateEnhancementSummary(summary);
  }

  public async analyze(): Promise<AnalysisResult> {
    this.log('Starting analysis in ${this.config.projectPath}...');
    
    try {
      // Scan project for components
      const projectScan = await this.scanProject();
      
      // Run each analyzer in sequence
      const visualResults = await this.visualAnalyzer.analyze(this.config.projectPath);
      
      const designTokenResults = this.config.designSystemPath 
        ? await this.designTokenAnalyzer.analyze(this.config.projectPath)
        : null;
      
      const animationResults = await this.animationTracker.analyze(this.config.projectPath);
      const cognitiveResults = await this.cognitiveLoadSimulator.analyze(this.config.projectPath);
      
      // Combine all issues
      const allIssues = [
        ...(visualResults?.layoutIssues || []),
        ...(designTokenResults?.violations || []),
        ...(animationResults?.performanceIssues || []),
        ...(cognitiveResults?.issues || [])
      ];
      
      // Generate summary
      const summary: UXEnhancementSummary = {
        id: `analysis-${Date.now()}`,
        appName: path.basename(this.config.projectPath),
        version: '1.0.0', // Get from package.json if available
        timestamp: new Date().toISOString(),
        duration: 0, // Calculate actual duration
        overallScore: this.calculateOverallScore([
          visualResults?.consistencyScore || 0,
          designTokenResults?.consistencyScore || 0,
          animationResults?.smoothness || 0,
          cognitiveResults?.score || 0
        ]),
        maxScore: 100,
        phases: [
          {
            phase: 'VISUAL_CONSISTENCY',
            score: visualResults?.consistencyScore || 0,
            maxScore: 100,
            issues: visualResults?.layoutIssues || []
          },
          {
            phase: 'DESIGN_TOKENS',
            score: designTokenResults?.consistencyScore || 0,
            maxScore: 100,
            issues: designTokenResults?.violations || []
          },
          {
            phase: 'ANIMATIONS',
            score: animationResults?.smoothness || 0,
            maxScore: 100,
            issues: animationResults?.performanceIssues || []
          },
          {
            phase: 'COGNITIVE_LOAD',
            score: cognitiveResults?.score || 0,
            maxScore: 100,
            issues: cognitiveResults?.issues || []
          }
        ],
        issues: allIssues
      };
      
      // Save results to output directory
      const outputPath = path.join(this.config.outputDir, `analysis-result-${Date.now()}.json`);
      await fs.writeJSON(outputPath, { summary, issues: allIssues }, { spaces: 2 });
      
      this.log(`Analysis completed. Results saved to ${outputPath}`);
      
      return {
        issues: allIssues,
        summary,
        success: true
      };
    } catch (error) {
      this.logError('Analysis failed', error);
      return {
        issues: [],
        summary: null as any,
        success: false,
        error: error.message
      };
    }
  }

  public async optimize(): Promise<OptimizationResult> {
    this.log('Starting optimization in ${this.config.projectPath}...');
    
    try {
      // First run analysis to get the baseline
      const analysisResult = await this.analyze();
      
      if (!analysisResult.success) {
        throw new Error(`Cannot optimize: Analysis failed - ${analysisResult.error}`);
      }
      
      // Generate optimization suggestions
      const suggestions = await this.generateSuggestions(analysisResult.issues);
      
      // Save optimization results
      const outputPath = path.join(this.config.outputDir, `optimization-result-${Date.now()}.json`);
      await fs.writeJSON(outputPath, { 
        summary: analysisResult.summary,
        issues: analysisResult.issues,
        suggestions
      }, { spaces: 2 });
      
      this.log(`Optimization completed. Results saved to ${outputPath}`);
      
      return {
        issues: analysisResult.issues,
        summary: analysisResult.summary,
        suggestions,
        success: true
      };
    } catch (error) {
      this.logError('Optimization failed', error);
      return {
        issues: [],
        summary: null as any,
        suggestions: [],
        success: false,
        error: error.message
      };
    }
  }

  public async generateComponent(options: ComponentGenerationOptions): Promise<ComponentGenerationResult> {
    this.log(`Generating ${options.componentType} component: ${options.componentName}...`);
    
    try {
      // Scan project to understand context
      const projectScan = await this.scanProject();
      
      // Generate the component
      const component = await this.componentGenerator.generate({
        ...options,
        projectPath: this.config.projectPath,
        designSystem: options.designSystem || this.config.designSystemPath
      });
      
      // Save the component to the output directory
      const outputDir = path.join(this.config.outputDir, 'generated', component.name);
      fs.ensureDirSync(outputDir);
      
      const filePath = path.join(outputDir, `${component.name}.tsx`);
      await fs.writeFile(filePath, component.code);
      
      // Save tests if available
      if (component.tests) {
        await fs.writeFile(path.join(outputDir, `${component.name}.test.tsx`), component.tests);
      }
      
      // Save documentation if available
      if (component.documentation) {
        await fs.writeFile(path.join(outputDir, `${component.name}.md`), component.documentation);
      }
      
      this.log(`Component generation completed. Files saved to ${outputDir}`);
      
      return {
        component: {
          ...component,
          filePath
        },
        success: true
      };
    } catch (error) {
      this.logError('Component generation failed', error);
      return {
        component: null as any,
        success: false,
        error: error.message
      };
    }
  }

  public async generateReportFromResult(resultPath: string, options: ReportOptions): Promise<AgentResult> {
    try {
      logger.info(`Generating report from result file: ${resultPath}`);
      
      if (!fs.existsSync(resultPath)) {
        throw new Error(`Result file not found: ${resultPath}`);
      }
      
      const optimizationResult: OptimizationResult = await fs.readJSON(resultPath);
      
      const reportPath = await this.generateReport(
        optimizationResult.summary,
        optimizationResult.suggestions,
        optimizationResult.generatedComponents,
        options
      );
      
      return {
        success: true,
        report: reportPath
      };
    } catch (error) {
      logger.error('Error generating report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  public async runTask(): Promise<AgentResult> {
    switch (this.config.mode) {
      case AgentMode.ANALYSIS:
        return await this.analyze();
      case AgentMode.GENERATION:
        // This mode is handled directly through generateComponent()
        throw new Error('Please use generateComponent() directly for component generation');
      case AgentMode.REPORTING:
        // This mode is handled directly through generateReportFromResult()
        throw new Error('Please use generateReportFromResult() directly for report generation');
      case AgentMode.INTEGRATION:
        return {
          success: true,
          report: 'Integration mode activated. Check your CI/PR system for details.'
        };
      case AgentMode.GUI:
        // Launch GUI mode
        logger.info('GUI mode is not yet implemented');
        return {
          success: false,
          error: 'GUI mode is not yet implemented'
        };
      default:
        return await this.optimize();
    }
  }

  private async scanProject(): Promise<ProjectScanResult> {
    this.log('Scanning project structure and components...');
    return this.projectScanner.scanProject(this.config.projectPath);
  }

  private calculateOverallScore(scores: number[]): number {
    if (scores.length === 0) return 0;
    
    // Apply different weights to different categories if needed
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[PersRM] ${message}`);
    }
  }

  private logError(message: string, error: Error): void {
    console.error(`[PersRM] ERROR: ${message}:`, error);
  }
} 