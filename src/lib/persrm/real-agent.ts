import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import glob from 'glob';
import { 
  PhaseType, 
  SeverityLevel, 
  UXIssue, 
  UXEnhancementSummary, 
  PhaseScore,
  AnalysisResult,
  OptimizationResult,
  PersRMConfig
} from './types';

import { VisualAnalyzer } from '../../analyzers/visual-analyzer';
import { DesignTokenAnalyzer } from '../../analyzers/design-token-analyzer';
import { AnimationPerformanceTracker } from '../../analyzers/animation-performance-tracker';
import { CognitiveLoadSimulator, CognitiveTask, InterfaceType } from '../../analyzers/cognitive-load-simulator';

/**
 * Real implementation of the PersRMAgent that uses all analyzers
 * for comprehensive UX analysis and optimization
 */
export class RealPersRMAgent {
  private config: PersRMConfig;
  private visualAnalyzer: VisualAnalyzer;
  private designTokenAnalyzer: DesignTokenAnalyzer;
  private animationPerformanceTracker: AnimationPerformanceTracker;
  private cognitiveLoadSimulator: CognitiveLoadSimulator;
  private results: AnalysisResult[] = [];
  
  constructor(config: PersRMConfig) {
    this.config = {
      verbose: false,
      outputPath: path.resolve(process.cwd(), 'persrm-output'),
      ...config
    };
    
    // Ensure output directory exists
    fs.ensureDirSync(this.config.outputPath);
    
    // Initialize analyzers
    this.initializeAnalyzers();
    
    if (this.config.verbose) {
      console.log(`[RealPersRMAgent] Initialized with configuration:`, {
        outputPath: this.config.outputPath,
        verbose: this.config.verbose,
        watchPath: this.config.watchPath || 'none'
      });
    }
  }
  
  /**
   * Initialize all analyzers with appropriate configurations
   */
  private initializeAnalyzers(): void {
    // Initialize Visual Analyzer
    this.visualAnalyzer = new VisualAnalyzer({
      screenshotDir: path.join(this.config.outputPath, 'screenshots'),
      baselineDir: path.join(this.config.outputPath, 'baselines'),
      verbose: this.config.verbose,
      components: this.loadComponentConfigs()
    });
    
    // Initialize Design Token Analyzer
    this.designTokenAnalyzer = new DesignTokenAnalyzer({
      designSystemPath: this.config.designSystemPath || path.join(this.config.projectPath, 'design-system.json'),
      tokensDir: path.join(this.config.projectPath, 'tokens'),
      verbose: this.config.verbose
    });
    
    // Initialize Animation Performance Tracker
    this.animationPerformanceTracker = new AnimationPerformanceTracker({
      verbose: this.config.verbose,
      headless: true
    });
    
    // Register common animations for components
    this.registerAnimations();
    
    // Initialize Cognitive Load Simulator
    this.cognitiveLoadSimulator = new CognitiveLoadSimulator({
      verbose: this.config.verbose
    });
  }
  
  /**
   * Load component configurations from project
   */
  private loadComponentConfigs(): any[] {
    try {
      const configPath = path.join(this.config.projectPath, 'persrm.config.json');
      
      if (fs.existsSync(configPath)) {
        const config = fs.readJSONSync(configPath);
        return config.components || [];
      }
    } catch (error) {
      if (this.config.verbose) {
        console.warn(`[RealPersRMAgent] Could not load component configs:`, error);
      }
    }
    
    // Return default component configurations
    return [
      {
        name: 'Button',
        selector: '.button, button',
        states: ['default', 'hover', 'active', 'disabled']
      },
      {
        name: 'Card',
        selector: '.card',
        states: ['default']
      },
      {
        name: 'Modal',
        selector: '.modal',
        states: ['default']
      },
      {
        name: 'Form',
        selector: 'form',
        states: ['default']
      }
    ];
  }
  
  /**
   * Register common animations for components
   */
  private registerAnimations(): void {
    // Register button animations
    this.animationPerformanceTracker.registerComponent('Button', [
      { name: 'hover', selector: '.button, button', type: 'hover', duration: 300 },
      { name: 'click', selector: '.button, button', type: 'click', duration: 200 }
    ]);
    
    // Register modal animations
    this.animationPerformanceTracker.registerComponent('Modal', [
      { name: 'open', selector: '.modal', type: 'custom', duration: 300 },
      { name: 'close', selector: '.modal', type: 'custom', duration: 300 }
    ]);
    
    // Register carousel/slider animations
    this.animationPerformanceTracker.registerComponent('Carousel', [
      { name: 'slide', selector: '.carousel, .slider', type: 'custom', duration: 500 }
    ]);
    
    // Register dropdown animations
    this.animationPerformanceTracker.registerComponent('Dropdown', [
      { name: 'open', selector: '.dropdown', type: 'click', duration: 300 }
    ]);
    
    // Register tab animations
    this.animationPerformanceTracker.registerComponent('Tabs', [
      { name: 'switch', selector: '.tab-panel, .tabs', type: 'click', duration: 250 }
    ]);
  }
  
  /**
   * Analyze a component or file
   */
  public async analyze(componentPath: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    const componentName = path.basename(componentPath, path.extname(componentPath));
    
    if (this.config.verbose) {
      console.log(`[RealPersRMAgent] Analyzing component: ${componentName}`);
    }
    
    try {
      // Collect results from each analyzer
      const phaseResults: PhaseScore[] = [];
      const allIssues: UXIssue[] = [];
      
      // 1. Visual Analysis (if enabled)
      try {
        const visualReport = await this.visualAnalyzer.generateReport(componentName);
        
        // Add phase scores
        phaseResults.push(...visualReport.phases);
        
        // Convert visual issues to UX issues
        const visualIssues = visualReport.visualIssues.map(vi => ({
          id: vi.id,
          component: componentName,
          phase: PhaseType.VISUAL_CONSISTENCY,
          message: vi.description,
          location: {
            file: componentPath,
            line: 0 // We don't have line information here
          },
          severity: vi.severity,
          impact: vi.impact,
          suggestion: vi.recommendation
        }));
        
        allIssues.push(...visualIssues);
      } catch (error) {
        console.error(`[RealPersRMAgent] Visual analysis error:`, error);
      }
      
      // 2. Design Token Analysis
      try {
        const tokenResults = await this.designTokenAnalyzer.extractTokensFromComponent(componentPath);
        
        // Add design tokens phase score
        phaseResults.push({
          phase: PhaseType.DESIGN_TOKENS,
          score: tokenResults.score,
          maxScore: tokenResults.maxScore
        });
        
        // Convert token issues to UX issues
        const tokenIssues = tokenResults.issues.map(ti => ({
          id: ti.id,
          component: componentName,
          phase: PhaseType.DESIGN_TOKENS,
          message: `${ti.tokenName}: ${ti.tokenValue} - ${ti.type}`,
          location: {
            file: componentPath,
            line: 0 // We don't have line information here
          },
          severity: ti.severity,
          impact: ti.impact,
          suggestion: ti.suggestion
        }));
        
        allIssues.push(...tokenIssues);
      } catch (error) {
        console.error(`[RealPersRMAgent] Design token analysis error:`, error);
      }
      
      // 3. Animation Performance Analysis
      try {
        const animationResult = await this.animationPerformanceTracker.analyzeComponent(componentName);
        
        // Add animation phase score
        phaseResults.push({
          phase: PhaseType.ANIMATIONS,
          score: animationResult.score,
          maxScore: animationResult.maxScore
        });
        
        // Convert animation issues to UX issues
        const animationIssues = animationResult.issues.map(ai => ({
          id: ai.id,
          component: componentName,
          phase: PhaseType.ANIMATIONS,
          message: ai.description,
          location: {
            file: componentPath,
            line: 0 // We don't have line information here
          },
          severity: ai.severity,
          impact: ai.impact,
          suggestion: ai.suggestion
        }));
        
        allIssues.push(...animationIssues);
      } catch (error) {
        console.error(`[RealPersRMAgent] Animation analysis error:`, error);
      }
      
      // 4. Cognitive Load Analysis
      try {
        // Create a default interface definition based on component type
        const interfaceDef = this.createInterfaceDefinition(componentName);
        
        // Define typical tasks for this component
        const tasks = this.getComponentTasks(componentName);
        
        // Analyze the component
        const cognitiveResult = this.cognitiveLoadSimulator.analyzeComponent(
          componentName,
          tasks,
          interfaceDef
        );
        
        // Add cognitive load phase score
        phaseResults.push({
          phase: PhaseType.RESPONSIVENESS,
          score: cognitiveResult.overallScore,
          maxScore: 100
        });
        
        // Convert cognitive issues to UX issues
        const cognitiveIssues = cognitiveResult.issues.map(ci => ({
          id: ci.id,
          component: componentName,
          phase: PhaseType.RESPONSIVENESS,
          message: ci.description,
          location: {
            file: componentPath,
            line: 0 // We don't have line information here
          },
          severity: ci.severity,
          impact: ci.impact,
          suggestion: ci.suggestion
        }));
        
        allIssues.push(...cognitiveIssues);
      } catch (error) {
        console.error(`[RealPersRMAgent] Cognitive analysis error:`, error);
      }
      
      // Calculate overall score
      let overallScore = 0;
      const maxScore = 100;
      
      if (phaseResults.length > 0) {
        // Calculate the average of all phase scores
        overallScore = Math.round(
          phaseResults.reduce((sum, phase) => sum + phase.score, 0) / phaseResults.length
        );
      }
      
      // Create enhancement summary
      const enhancementSummary: UXEnhancementSummary = {
        id: uuidv4(),
        appName: this.config.appName || 'Unknown',
        version: this.config.version || '1.0.0',
        componentName,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        overallScore,
        maxScore,
        phases: phaseResults,
        issues: allIssues
      };
      
      // Create analysis result
      const result: AnalysisResult = {
        componentId: componentName,
        componentPath,
        componentType: this.detectComponentType(componentPath),
        timestamp: new Date().toISOString(),
        summary: enhancementSummary
      };
      
      // Store the result
      this.results.push(result);
      
      return result;
    } catch (error) {
      console.error(`[RealPersRMAgent] Analysis error:`, error);
      
      // Create a minimal result with the error
      return {
        componentId: componentName,
        componentPath,
        componentType: this.detectComponentType(componentPath),
        timestamp: new Date().toISOString(),
        error: error.message,
        summary: {
          id: uuidv4(),
          appName: this.config.appName || 'Unknown',
          version: this.config.version || '1.0.0',
          componentName,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          overallScore: 0,
          maxScore: 100,
          phases: [],
          issues: [{
            id: uuidv4(),
            component: componentName,
            phase: PhaseType.RESPONSIVENESS,
            message: `Analysis error: ${error.message}`,
            location: {
              file: componentPath,
              line: 0
            },
            severity: SeverityLevel.ERROR,
            impact: 'High',
            suggestion: 'Check component for errors'
          }]
        }
      };
    }
  }
  
  /**
   * Analyze a directory of components
   */
  public async analyzeDirectory(directoryPath: string): Promise<AnalysisResult[]> {
    if (this.config.verbose) {
      console.log(`[RealPersRMAgent] Analyzing directory: ${directoryPath}`);
    }
    
    try {
      // Find component files
      const files = glob.sync(path.join(directoryPath, '**/*.{jsx,tsx,js,ts}'), {
        ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*']
      });
      
      if (this.config.verbose) {
        console.log(`[RealPersRMAgent] Found ${files.length} files to analyze`);
      }
      
      // Analyze each file
      const results: AnalysisResult[] = [];
      
      for (const file of files) {
        try {
          const result = await this.analyze(file);
          results.push(result);
        } catch (error) {
          console.error(`[RealPersRMAgent] Error analyzing ${file}:`, error);
        }
      }
      
      return results;
    } catch (error) {
      console.error(`[RealPersRMAgent] Error analyzing directory:`, error);
      return [];
    }
  }
  
  /**
   * Optimize a component based on analysis results
   */
  public async optimize(componentPath: string): Promise<OptimizationResult> {
    const componentName = path.basename(componentPath, path.extname(componentPath));
    
    if (this.config.verbose) {
      console.log(`[RealPersRMAgent] Optimizing component: ${componentName}`);
    }
    
    // Find existing analysis or run a new one
    let analysis = this.results.find(r => r.componentId === componentName);
    
    if (!analysis) {
      analysis = await this.analyze(componentPath);
    }
    
    // Generate optimization suggestions based on issues
    const suggestions = this.generateSuggestions(analysis);
    
    // Create optimization result
    const result: OptimizationResult = {
      componentId: componentName,
      componentPath,
      timestamp: new Date().toISOString(),
      originalScore: analysis.summary.overallScore,
      estimatedImprovedScore: this.estimateImprovedScore(analysis.summary.overallScore, suggestions),
      suggestions
    };
    
    return result;
  }
  
  /**
   * Optimize multiple components
   */
  public async optimizeMultiple(
    analysisResults: AnalysisResult[]
  ): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];
    
    for (const analysis of analysisResults) {
      try {
        const result = await this.optimize(analysis.componentPath);
        results.push(result);
      } catch (error) {
        console.error(`[RealPersRMAgent] Error optimizing ${analysis.componentId}:`, error);
      }
    }
    
    return results;
  }
  
  /**
   * Generate suggestions based on analysis results
   */
  private generateSuggestions(analysis: AnalysisResult): Array<{
    id: string;
    type: string;
    description: string;
    impact: string;
    complexity: string;
    before?: string;
    after?: string;
  }> {
    const suggestions = [];
    
    // Convert issues to suggestions
    for (const issue of analysis.summary.issues) {
      // Skip issues with no suggestions
      if (!issue.suggestion) continue;
      
      suggestions.push({
        id: uuidv4(),
        type: issue.phase,
        description: `${issue.message} - ${issue.suggestion}`,
        impact: issue.impact || 'Medium',
        complexity: this.estimateComplexity(issue),
        before: null,
        after: null
      });
    }
    
    return suggestions;
  }
  
  /**
   * Estimate the improved score after applying suggestions
   */
  private estimateImprovedScore(
    originalScore: number, 
    suggestions: Array<{ impact: string }>
  ): number {
    // Simple improvement estimate based on number and impact of suggestions
    let improvementPoints = 0;
    
    for (const suggestion of suggestions) {
      switch (suggestion.impact) {
        case 'High':
          improvementPoints += 3;
          break;
        case 'Medium':
          improvementPoints += 2;
          break;
        case 'Low':
          improvementPoints += 1;
          break;
      }
    }
    
    // Cap the maximum improvement
    improvementPoints = Math.min(improvementPoints, 30);
    
    // Calculate improved score
    const improvedScore = Math.min(100, originalScore + improvementPoints);
    
    return improvedScore;
  }
  
  /**
   * Estimate the complexity of implementing a suggestion
   */
  private estimateComplexity(issue: UXIssue): string {
    // Estimate based on severity and phase
    if (issue.severity === SeverityLevel.CRITICAL || issue.severity === SeverityLevel.ERROR) {
      return 'High';
    }
    
    // Visual and token issues are typically easier to fix
    if (issue.phase === PhaseType.VISUAL_CONSISTENCY || issue.phase === PhaseType.DESIGN_TOKENS) {
      return 'Low';
    }
    
    // Animation and responsiveness issues can be more complex
    if (issue.phase === PhaseType.ANIMATIONS || issue.phase === PhaseType.RESPONSIVENESS) {
      return 'Medium';
    }
    
    // Default to medium complexity
    return 'Medium';
  }
  
  /**
   * Detect component type based on file extension and naming conventions
   */
  private detectComponentType(componentPath: string): string {
    const fileName = path.basename(componentPath).toLowerCase();
    const extension = path.extname(componentPath).toLowerCase();
    
    if (fileName.includes('button')) return 'Button';
    if (fileName.includes('card')) return 'Card';
    if (fileName.includes('modal')) return 'Modal';
    if (fileName.includes('form')) return 'Form';
    if (fileName.includes('input')) return 'Input';
    if (fileName.includes('select')) return 'Select';
    if (fileName.includes('checkbox')) return 'Checkbox';
    if (fileName.includes('radio')) return 'Radio';
    if (fileName.includes('tab')) return 'Tabs';
    if (fileName.includes('menu')) return 'Menu';
    if (fileName.includes('nav')) return 'Navigation';
    if (fileName.includes('carousel') || fileName.includes('slider')) return 'Carousel';
    if (fileName.includes('table')) return 'Table';
    if (fileName.includes('list')) return 'List';
    if (fileName.includes('icon')) return 'Icon';
    if (fileName.includes('toast') || fileName.includes('notification')) return 'Notification';
    
    // Default to generic component type based on extension
    switch (extension) {
      case '.tsx':
      case '.jsx':
        return 'ReactComponent';
      case '.vue':
        return 'VueComponent';
      case '.svelte':
        return 'SvelteComponent';
      default:
        return 'Component';
    }
  }
  
  /**
   * Create a default interface definition for a component
   */
  private createInterfaceDefinition(componentName: string) {
    const componentLower = componentName.toLowerCase();
    let interfaceType = InterfaceType.MEDIUM;
    
    // Estimate interface complexity based on component type
    if (componentLower.includes('form') || 
        componentLower.includes('table') || 
        componentLower.includes('dashboard')) {
      interfaceType = InterfaceType.COMPLEX;
    } else if (componentLower.includes('button') || 
               componentLower.includes('icon') || 
               componentLower.includes('badge')) {
      interfaceType = InterfaceType.SIMPLE;
    }
    
    return this.cognitiveLoadSimulator['createDefaultInterfaceDef'](interfaceType);
  }
  
  /**
   * Define typical tasks for a component
   */
  private getComponentTasks(componentName: string) {
    const componentLower = componentName.toLowerCase();
    
    // Define common tasks based on component type
    if (componentLower.includes('button')) {
      return [CognitiveTask.CLICK_BUTTON];
    }
    
    if (componentLower.includes('form') || componentLower.includes('input')) {
      return [CognitiveTask.FORM_FILL];
    }
    
    if (componentLower.includes('nav') || componentLower.includes('menu')) {
      return [CognitiveTask.NAVIGATION];
    }
    
    if (componentLower.includes('search')) {
      return [CognitiveTask.SEARCH];
    }
    
    if (componentLower.includes('select') || componentLower.includes('dropdown')) {
      return [CognitiveTask.SELECTION];
    }
    
    if (componentLower.includes('drag') || componentLower.includes('slider')) {
      return [CognitiveTask.DRAG_DROP];
    }
    
    if (componentLower.includes('wizard') || componentLower.includes('flow')) {
      return [CognitiveTask.MULTI_STEP];
    }
    
    // Default to a simple click task
    return [CognitiveTask.CLICK_BUTTON];
  }
  
  /**
   * Get the current analysis results
   */
  public getResults(): AnalysisResult[] {
    return this.results;
  }
  
  /**
   * Save results to a JSON file
   */
  public saveResults(): string {
    const outputPath = path.join(this.config.outputPath, 'analysis-results.json');
    
    try {
      fs.ensureDirSync(path.dirname(outputPath));
      fs.writeJSONSync(outputPath, this.results, { spaces: 2 });
      
      if (this.config.verbose) {
        console.log(`[RealPersRMAgent] Results saved to: ${outputPath}`);
      }
      
      return outputPath;
    } catch (error) {
      console.error(`[RealPersRMAgent] Error saving results:`, error);
      return null;
    }
  }
} 