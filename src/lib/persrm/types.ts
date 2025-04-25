import { EnhancementSummary, UXIssue as EnhancerUXIssue } from '../ux-enhancer/types';

export enum AgentMode {
  ANALYSIS = 'analysis',
  OPTIMIZATION = 'optimization',
  GENERATION = 'generation',
  REPORTING = 'reporting',
  GUI = 'gui'
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
  LOAD_TIME = 'LOAD_TIME',
  RESPONSIVENESS = 'RESPONSIVENESS',
  ACCESSIBILITY = 'ACCESSIBILITY',
  VISUAL_CONSISTENCY = 'VISUAL_CONSISTENCY',
  COGNITIVE_LOAD = 'COGNITIVE_LOAD',
  ANIMATIONS = 'ANIMATIONS',
  DESIGN_TOKENS = 'DESIGN_TOKENS'
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
  projectPath: string;
  outputDir: string;
  mode: AgentMode;
  verbose?: boolean;
  takeScreenshots?: boolean;
  designSystemPath?: string;
  ciMode?: boolean;
  prNumber?: number;
  branch?: string;
  githubToken?: string;
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
  componentName: string;
  componentType: string | ComponentType;
  requirements?: string;
  dependencies?: string[];
  designSystem?: string;
}

export interface ReportOptions {
  format: 'html' | 'json' | 'md';
  includeScreenshots?: boolean;
  includeDiffs?: boolean;
  compareWithPrevious?: boolean;
  previousResultPath?: string;
  ciIntegration?: boolean;
  prNumber?: number;
}

export interface UXIssue {
  id: string;
  component: string;
  description: string;
  severity: SeverityLevel;
  phase: PhaseType;
  location?: string;
  code?: string;
  suggestedFix?: string;
  screenshot?: string;
}

export interface PhaseScore {
  phase: PhaseType;
  score: number;
  maxScore: number;
  issues: UXIssue[];
}

export interface UXEnhancementSummary {
  id: string;
  appName: string;
  version: string;
  timestamp: string;
  duration: number;
  overallScore: number;
  maxScore: number;
  phases: PhaseScore[];
  issues: UXIssue[];
}

export interface EnhancementSuggestion {
  id: string;
  component: string;
  description: string;
  before?: string;
  after?: string;
  impact: number;
  complexity: number;
  phase: PhaseType;
}

export interface AnalysisResult {
  issues: UXIssue[];
  summary: UXEnhancementSummary;
  success: boolean;
  error?: string;
}

export interface OptimizationResult {
  issues: UXIssue[];
  suggestions: EnhancementSuggestion[];
  summary: UXEnhancementSummary;
  success: boolean;
  error?: string;
}

export interface GeneratedComponent {
  name: string;
  type: ComponentType;
  code: string;
  dependencies: string[];
  tests: string;
  documentation: string;
  filePath: string;
}

export interface ComponentGenerationResult {
  component: GeneratedComponent;
  success: boolean;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface AgentResult {
  success: boolean;
  report?: string;
  error?: string;
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
  components: ComponentInfo[];
  designSystem?: {
    path: string;
    tokens: number;
  };
  framework: string;
  dependencies: string[];
} 