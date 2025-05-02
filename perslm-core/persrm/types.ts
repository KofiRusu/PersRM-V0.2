import { EnhancementSummary, UXIssue as EnhancerUXIssue } from '../ux-enhancer/types';

export enum AgentMode {
  ANALYSIS = 'analysis',
  OPTIMIZATION = 'optimization',
  GENERATION = 'generation',
  REPORTING = 'reporting'
}

export enum ComponentType {
  BUTTON = 'BUTTON',
  CARD = 'CARD',
  FORM = 'FORM',
  MODAL = 'MODAL',
  NAVIGATION = 'NAVIGATION',
  TABLE = 'TABLE',
  CUSTOM = 'CUSTOM'
}

export enum SeverityLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export enum PhaseType {
  DESIGN_CONSISTENCY = 'design_consistency',
  ANIMATION_PERFORMANCE = 'animation_performance',
  RESPONSIVENESS = 'responsiveness',
  ACCESSIBILITY = 'accessibility',
  LOAD_TIME = 'load_time',
  VISUAL_CONSISTENCY = 'visual_consistency',
  ANIMATIONS = 'animations'
}

export enum PriorityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum SuggestionType {
  CODE_CHANGE = 'CODE_CHANGE',
  REFACTOR = 'REFACTOR',
  COMPONENT_EXTRACTION = 'COMPONENT_EXTRACTION',
  DESIGN_TOKEN_UPDATE = 'DESIGN_TOKEN_UPDATE',
  ANIMATION_OPTIMIZATION = 'ANIMATION_OPTIMIZATION',
  ACCESSIBILITY_FIX = 'ACCESSIBILITY_FIX'
}

export interface PersRMConfig {
  mode: AgentMode;
  projectPath: string;
  outputDir: string;
  designSystemPath?: string;
  options?: Record<string, any>;
}

export interface VisualAnalysisConfig {
  screenshotDir: string;
  viewport: {
    width: number;
    height: number;
  };
  devices?: string[];
  compareWithBaseline?: boolean;
  baselineDir?: string;
}

export interface DesignTokenConfig {
  designSystemPath: string;
  checkConsistency: boolean;
  enforcedTokens?: string[];
}

export interface AccessibilityConfig {
  standard: 'WCAG2A' | 'WCAG2AA' | 'WCAG2AAA';
  includeManualChecks: boolean;
}

export interface ComponentGenerationOptions {
  name: string;
  type: string;
  framework?: string;
  styling?: string;
  accessibility?: boolean;
  phase?: 'baseline' | 'enhance' | 'full';
}

export interface ReportOptions {
  format: 'html' | 'markdown' | 'json';
  includeCharts: boolean;
  includeSuggestions: boolean;
  includeCode: boolean;
}

export interface UXIssue {
  id: string;
  title: string;
  description: string;
  severity: string;
  priority: string;
  phase: PhaseType;
  component: string;
  element?: string;
}

export interface PhaseScore {
  phase: PhaseType;
  score: number;
  maxScore: number;
  issues: UXIssue[];
}

export interface UXEnhancementSummary {
  id: string;
  timestamp: Date;
  projectName: string;
  overallScore: number;
  componentScores: Record<string, number>;
  recommendations: EnhancementSuggestion[];
  topIssues: UXIssue[];
}

export interface EnhancementSuggestion {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  issues: string[];
  estimatedImpact: number;
}

export interface AnalysisResult {
  id: string;
  timestamp: Date;
  component: string;
  visualResults: any;
  designTokenResults: any;
  animationResults: any;
  cognitiveLoadResults: any;
  accessibility: any;
  issues: UXIssue[];
}

export interface OptimizationResult {
  success: boolean;
  enhancementSummary: UXEnhancementSummary;
  generatedComponents: GeneratedComponent[];
  reportPath: string;
}

export interface GeneratedComponent {
  name: string;
  type: string;
  files: { path: string; content: string }[];
}

export interface ComponentGenerationResult {
  success: boolean;
  component?: GeneratedComponent;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface AgentResult {
  success: boolean;
  data?: any;
  error?: string;
  reportPath?: string;
}

export interface ComponentInfo {
  name: string;
  path: string;
  type: string;
  size: number;
  dependencies: string[];
}

export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  interactionTime: number;
  memoryUsage: number;
}

export interface AnimationMetrics {
  duration: number;
  framesPerSecond: number;
  smoothness: number;
  complexity: number;
}

export interface AccessibilityCheckResult {
  passed: boolean;
  standard: string;
  issues: UXIssue[];
}

export interface VisualConsistencyResult {
  consistencyScore: number;
  designSystemCompliance: number;
  issues: UXIssue[];
}

export interface CognitiveLoadResult {
  score: number;
  factors: {
    visualComplexity: number;
    informationDensity: number;
    interactionComplexity: number;
  };
  issues: UXIssue[];
}

export interface DesignTokenAnalysisResult {
  consistencyScore: number;
  violations: UXIssue[];
  suggestions: EnhancementSuggestion[];
}

export interface ComponentMatch {
  path: string;
  name: string;
  type: string;
  extension: string;
}

export interface CIIntegrationConfig {
  provider: 'github' | 'gitlab' | 'azure' | 'bitbucket';
  token: string;
  repository: string;
  prNumber?: number;
  branch?: string;
  commentOnPR?: boolean;
  failOnIssues?: boolean;
  severityThreshold?: SeverityLevel;
}

export interface ProjectScanResult {
  components: string[];
  designTokens: Record<string, any>;
  dependencies: string[];
  frameworks: string[];
}

export interface EnhancementOptions {
  addMotion?: boolean;
  enhanceAccessibility?: boolean;
  improveResponsiveness?: boolean;
  enhanceVisuals?: boolean;
} 