import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import { 
  PersRMConfig, 
  AnalysisResult, 
  UXIssue, 
  PhaseScore,
  UXEnhancementSummary,
  PhaseType,
  SeverityLevel
} from './types';

export class UXAnalyzer extends EventEmitter {
  private config: PersRMConfig;
  private results: Map<string, AnalysisResult> = new Map();
  
  constructor(config: PersRMConfig) {
    super();
    this.config = {
      verbose: false,
      outputPath: './reports',
      ...config
    };
  }

  public async analyze(componentPath: string): Promise<AnalysisResult> {
    const componentName = path.basename(componentPath).split('.')[0];
    
    if (this.config.verbose) {
      console.log(`Analyzing component: ${componentName}`);
    }

    // Mock analysis result for now
    const result: AnalysisResult = {
      componentId: componentName,
      componentPath: componentPath,
      componentType: this.detectComponentType(componentPath),
      summary: this.generateMockSummary(componentName),
      timestamp: new Date().toISOString(),
      duration: 120 + Math.floor(Math.random() * 500),
    };

    this.results.set(componentName, result);
    this.emit('analysis-complete', result);
    
    return result;
  }

  public async analyzeDirectory(directory: string): Promise<AnalysisResult[]> {
    if (!fs.existsSync(directory)) {
      throw new Error(`Directory does not exist: ${directory}`);
    }

    const files = await fs.readdir(directory);
    const componentFiles = files.filter(file => 
      /\.(tsx|jsx|vue|svelte)$/.test(file)
    );

    const results: AnalysisResult[] = [];
    
    for (const file of componentFiles) {
      const result = await this.analyze(path.join(directory, file));
      results.push(result);
    }

    return results;
  }

  public getResults(): AnalysisResult[] {
    return Array.from(this.results.values());
  }

  public saveResults(outputPath: string = this.config.outputPath): void {
    const results = this.getResults();
    
    if (results.length === 0) {
      console.log('No results to save');
      return;
    }

    fs.ensureDirSync(outputPath);
    
    const filePath = path.join(outputPath, `analysis-${new Date().getTime()}.json`);
    fs.writeJSONSync(filePath, results, { spaces: 2 });
    
    if (this.config.verbose) {
      console.log(`Results saved to: ${filePath}`);
    }
  }

  private detectComponentType(componentPath: string): string {
    const extension = path.extname(componentPath);
    
    switch (extension) {
      case '.tsx':
        return 'React';
      case '.jsx':
        return 'React';
      case '.vue':
        return 'Vue';
      case '.svelte':
        return 'Svelte';
      default:
        return 'Unknown';
    }
  }

  private generateMockSummary(componentName: string): UXEnhancementSummary {
    const now = new Date();
    
    // Generate random phase scores
    const phases: PhaseScore[] = Object.values(PhaseType).map(phase => ({
      phase,
      score: 60 + Math.floor(Math.random() * 40),
      maxScore: 100,
      issues: []
    }));

    // Generate random issues
    const issues: UXIssue[] = [
      {
        id: `${componentName}-1`,
        component: componentName,
        phase: PhaseType.LOAD_TIME,
        message: 'Component has unnecessary re-renders',
        location: { file: `${componentName}.tsx`, line: 45 },
        severity: SeverityLevel.WARNING,
        impact: 'Moderate',
        suggestion: 'Consider using React.memo or useMemo for expensive calculations'
      },
      {
        id: `${componentName}-2`,
        component: componentName,
        phase: PhaseType.RESPONSIVENESS,
        message: 'Click handler has excessive work in the main thread',
        location: { file: `${componentName}.tsx`, line: 78 },
        severity: SeverityLevel.ERROR,
        impact: 'High',
        suggestion: 'Move heavy computation to a web worker or debounce the function'
      }
    ];

    // Add issues to their respective phases
    issues.forEach(issue => {
      const phaseIndex = phases.findIndex(p => p.phase === issue.phase);
      if (phaseIndex >= 0) {
        phases[phaseIndex].issues.push(issue);
      }
    });

    // Calculate overall score based on phase scores
    const totalScore = phases.reduce((sum, phase) => sum + phase.score, 0);
    const maxPossibleScore = phases.length * 100;

    return {
      id: `${componentName}-${now.getTime()}`,
      appName: 'PersLM',
      version: '1.0.0',
      timestamp: now.toISOString(),
      duration: 850,
      overallScore: Math.floor(totalScore / phases.length),
      maxScore: 100,
      phases,
      issues
    };
  }
} 