/**
 * PersLM Plugin Enhancer Schema Definitions
 * 
 * This module provides TypeScript type definitions for the plugin enhancer database models.
 */

import { SeverityLevel, SuggestionType } from './plugin_enhancer';

/**
 * Database model for PluginEnhancerReport
 */
export interface DbPluginEnhancerReport {
  id: number;
  timestamp: Date;
  pluginCount: number;
  okCount: number;
  warningCount: number;
  errorCount: number;
  globalSuggestions?: DbGlobalSuggestion[];
  analyses?: DbPluginAnalysis[];
  training?: DbTrainingSession[];
}

/**
 * Database model for GlobalSuggestion
 */
export interface DbGlobalSuggestion {
  id: number;
  type: string;
  severity: string;
  message: string;
  details?: string | null;
  reportId: number;
  report?: DbPluginEnhancerReport;
}

/**
 * Database model for PluginAnalysis
 */
export interface DbPluginAnalysis {
  id: number;
  pluginId: string;
  pluginName?: string | null;
  status: 'ok' | 'warning' | 'error';
  initTime?: number | null;
  renderTime?: number | null;
  destroyTime?: number | null;
  errorCount?: number | null;
  reportId: number;
  report?: DbPluginEnhancerReport;
  suggestions?: DbPluginSuggestion[];
}

/**
 * Database model for PluginSuggestion
 */
export interface DbPluginSuggestion {
  id: number;
  type: string;
  severity: string;
  message: string;
  details?: string | null;
  code?: string | null;
  analysisId: number;
  analysis?: DbPluginAnalysis;
}

/**
 * Database model for ModelComparison
 */
export interface DbModelComparison {
  id: number;
  pluginId: string;
  modelType: string;
  baselineInitTime?: number | null;
  baselineRenderTime?: number | null;
  baselineDestroyTime?: number | null;
  comparisonInitTime?: number | null;
  comparisonRenderTime?: number | null;
  comparisonDestroyTime?: number | null;
  initTimeImprovement?: number | null;
  renderTimeImprovement?: number | null;
  destroyTimeImprovement?: number | null;
  timestamp: Date;
  trainingSessionId?: number | null;
  trainingSession?: DbTrainingSession;
}

/**
 * Database model for TrainingSession
 */
export interface DbTrainingSession {
  id: number;
  startTime: Date;
  endTime?: Date | null;
  status: 'running' | 'completed' | 'failed';
  baselineModel: string;
  experimentalModel: string;
  iterations: number;
  reportId: number;
  report?: DbPluginEnhancerReport;
  results?: DbModelComparison[];
  learnings?: DbTrainingLearning[];
}

/**
 * Database model for TrainingLearning
 */
export interface DbTrainingLearning {
  id: number;
  category: string;
  description: string;
  confidence: number;
  appliedToPlugins: string[];
  trainingSessionId: number;
  trainingSession?: DbTrainingSession;
  timestamp: Date;
}

/**
 * Type for API query results when getting training data
 */
export interface TrainingDataResult {
  reports: DbPluginEnhancerReport[];
  analyses: DbPluginAnalysis[];
  comparisons: DbModelComparison[];
  learnings: DbTrainingLearning[];
}

/**
 * Type for dashboard summary data
 */
export interface DashboardSummary {
  totalPlugins: number;
  totalSessions: number;
  totalLearnings: number;
  successRate: number;
  averageInitImprovement: number;
  averageRenderImprovement: number;
  lastTrainingDate?: Date;
}

/**
 * Type for plugin enhancement metrics over time
 */
export interface PluginEnhancementMetrics {
  pluginId: string;
  pluginName?: string;
  timestamps: Date[];
  initTimes: number[];
  renderTimes: number[];
  destroyTimes: number[];
  improvements: {
    init: number[];
    render: number[];
    destroy: number[];
  };
}

/**
 * Type-safe utility functions for querying training history
 */

/**
 * Get the most recent training session
 */
export async function getLatestTrainingSession(prisma: any): Promise<DbTrainingSession | null> {
  return prisma.trainingSession.findFirst({
    orderBy: {
      startTime: 'desc'
    },
    include: {
      learnings: true,
      results: true
    }
  });
}

/**
 * Get training data summary for dashboard
 */
export async function getTrainingDataSummary(prisma: any): Promise<DashboardSummary> {
  const sessionsCount = await prisma.trainingSession.count();
  const latestSession = await getLatestTrainingSession(prisma);
  const comparisons = await prisma.modelComparison.findMany();
  const learningsCount = await prisma.trainingLearning.count();
  
  // Calculate success rate and average improvements
  const successCount = comparisons.filter(c => 
    (c.initTimeImprovement && c.initTimeImprovement > 0) || 
    (c.renderTimeImprovement && c.renderTimeImprovement > 0)
  ).length;
  
  const successRate = comparisons.length > 0 
    ? (successCount / comparisons.length) * 100 
    : 0;
  
  const initImprovements = comparisons
    .map(c => c.initTimeImprovement)
    .filter((imp): imp is number => !!imp);
  
  const renderImprovements = comparisons
    .map(c => c.renderTimeImprovement)
    .filter((imp): imp is number => !!imp);
  
  const avgInitImprovement = initImprovements.length > 0
    ? initImprovements.reduce((sum, val) => sum + val, 0) / initImprovements.length
    : 0;
  
  const avgRenderImprovement = renderImprovements.length > 0
    ? renderImprovements.reduce((sum, val) => sum + val, 0) / renderImprovements.length
    : 0;
  
  return {
    totalPlugins: 0, // This would come from the actual plugin count in the system
    totalSessions: sessionsCount,
    totalLearnings: learningsCount,
    successRate,
    averageInitImprovement: avgInitImprovement,
    averageRenderImprovement: avgRenderImprovement,
    lastTrainingDate: latestSession?.endTime || latestSession?.startTime
  };
}

/**
 * Get enhancement metrics for a specific plugin over time
 */
export async function getPluginEnhancementMetrics(
  prisma: any, 
  pluginId: string
): Promise<PluginEnhancementMetrics | null> {
  const analyses = await prisma.pluginAnalysis.findMany({
    where: {
      pluginId
    },
    include: {
      report: true
    },
    orderBy: {
      report: {
        timestamp: 'asc'
      }
    }
  });
  
  if (analyses.length === 0) {
    return null;
  }
  
  const comparisons = await prisma.modelComparison.findMany({
    where: {
      pluginId
    },
    orderBy: {
      timestamp: 'asc'
    }
  });
  
  const result: PluginEnhancementMetrics = {
    pluginId,
    pluginName: analyses[0].pluginName || undefined,
    timestamps: analyses.map(a => a.report.timestamp),
    initTimes: analyses.map(a => a.initTime || 0),
    renderTimes: analyses.map(a => a.renderTime || 0),
    destroyTimes: analyses.map(a => a.destroyTime || 0),
    improvements: {
      init: comparisons.map(c => c.initTimeImprovement || 0),
      render: comparisons.map(c => c.renderTimeImprovement || 0),
      destroy: comparisons.map(c => c.destroyTimeImprovement || 0)
    }
  };
  
  return result;
} 