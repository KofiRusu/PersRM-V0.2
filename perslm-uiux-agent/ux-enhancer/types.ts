// UX Enhancer Types

// Enum for different phases of UX analysis
export enum PhaseType {
  LOAD_TIME = 'loadTime',
  RESPONSIVENESS = 'responsiveness',
  ACCESSIBILITY = 'accessibility',
  INTERACTION = 'interaction',
  RESOURCE_USAGE = 'resourceUsage'
}

// Enum for severity levels of issues
export enum SeverityLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Enum for report formats
export enum ReportFormat {
  PDF = 'pdf',
  HTML = 'html',
  JSON = 'json',
  CSV = 'csv',
}

// Issue found during analysis
export interface Issue {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  recommendations: string[];
  screenshot?: string; // Optional URL to screenshot
}

// Results for a single phase
export interface PhaseResult {
  score: number; // 0-100
  issues: Issue[];
  timestamp: string; // ISO string
}

// Progress information during analysis
export interface UXScoreProgress {
  completed: number;
  total: number;
  percentage: number; // 0-100
}

// Complete summary of enhancement results
export interface EnhancementSummary {
  id: string;
  appName: string;
  version: string;
  timestamp: number;
  duration: number;
  overallScore: number;
  maxScore: number;
  phases: Record<PhaseType, PhaseScore>;
  issues: UXIssue[];
}

// Configuration for report generation
export interface ReportConfig {
  format: ReportFormat;
  includeScreenshots: boolean;
  detailLevel: 'basic' | 'detailed' | 'comprehensive';
}

// Validation result for enhancement summary
export interface ValidationResult {
  valid: boolean;
  missingPhases?: string[];
  invalidPhases?: string[];
  errors?: string[];
}

// Event types map for typesafe event handling
export interface UXEnhancerEvents {
  UPDATE: 'ux-enhancer:update';
  ERROR: 'ux-enhancer:error';
  PHASE_COMPLETE: 'ux-enhancer:phase-complete';
  ANALYSIS_START: 'ux-enhancer:analysis-start';
  ANALYSIS_COMPLETE: 'ux-enhancer:analysis-complete';
}

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  includeScreenshots: true,
  format: 'html',
  detailLevel: 'basic'
};

export interface UXIssue {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  phase: PhaseType;
  timestamp: number;
  affectedComponents?: string[];
  suggestedFix?: string;
}

export interface PhaseScore {
  score: number;
  maxScore: number;
  issues: UXIssue[];
  startTimestamp: number;
  endTimestamp: number;
  metadata?: Record<string, any>;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }[];
}

export interface ReportOptions {
  includeCharts?: boolean;
  includeIssues?: boolean;
  format?: 'json' | 'html' | 'pdf' | 'csv';
  outputPath?: string;
} 