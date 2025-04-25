import fs from 'fs-extra';
import path from 'path';
import { UXEnhancementSummary, PhaseType } from '../persrm/types';
import { BenchmarkTracker, BenchmarkEntry } from '../../lib/benchmarks/BenchmarkTracker';

/**
 * Filter options for benchmark queries
 */
export interface BenchmarkFilter {
  project?: string;
  component?: string;
  branch?: string;
  startDate?: Date;
  endDate?: Date;
  minScore?: number;
}

/**
 * Enhanced benchmark entry with additional analytics data
 */
export interface EnhancedBenchmarkEntry extends BenchmarkEntry {
  delta?: {
    overallScore: number;
    percentChange: number;
    phaseDeltas: Record<PhaseType, number>;
    newIssues: string[];
    resolvedIssues: string[];
    unchangedIssues: string[];
  };
  reportUrl?: string;
}

// Singleton instance of the benchmark tracker
const benchmarkTracker = new BenchmarkTracker();

/**
 * Log a new benchmark entry based on a UX enhancement summary
 * @param summary The UX enhancement summary to log
 * @param metadata Additional metadata
 * @returns The created benchmark entry
 */
export function logBenchmark(
  summary: UXEnhancementSummary,
  metadata: {
    branch?: string;
    commitSha?: string;
    author?: string;
  } = {}
): EnhancedBenchmarkEntry {
  // Create a new benchmark entry
  const entry = benchmarkTracker.addEntry({
    summary,
    timestamp: Date.now(),
    branch: metadata.branch || 'main',
    commitSha: metadata.commitSha,
    author: metadata.author,
  });

  // Get the previous entry for the same component/app for comparison
  const filter: BenchmarkFilter = {};
  if (summary.componentName) {
    filter.component = summary.componentName;
  }
  if (summary.appName) {
    filter.project = summary.appName;
  }

  const history = getBenchmarkHistory(2, filter);
  
  if (history.length > 1) {
    const current = history[0];
    const previous = history[1];
    
    // Calculate delta between current and previous
    const delta = {
      overallScore: current.summary.overallScore - previous.summary.overallScore,
      percentChange: ((current.summary.overallScore - previous.summary.overallScore) / previous.summary.overallScore) * 100,
      phaseDeltas: calculatePhaseDeltas(current.summary, previous.summary),
      ...calculateIssueChanges(current.summary, previous.summary)
    };
    
    return {
      ...entry,
      delta
    };
  }
  
  return entry as EnhancedBenchmarkEntry;
}

/**
 * Get benchmark history with optional filtering
 * @param limit Maximum number of entries to return
 * @param filter Filter options
 * @returns Array of benchmark entries
 */
export function getBenchmarkHistory(
  limit = 10,
  filter: BenchmarkFilter = {}
): EnhancedBenchmarkEntry[] {
  // Get all entries from the benchmark tracker
  let entries = benchmarkTracker.getEntries();
  
  // Apply filters
  entries = applyBenchmarkFilter(entries, filter);
  
  // Sort by timestamp (newest first)
  entries.sort((a, b) => b.timestamp - a.timestamp);
  
  // Limit the number of results
  entries = entries.slice(0, limit);
  
  // Enhance entries with delta information
  return enhanceEntriesWithDelta(entries);
}

/**
 * Get benchmark comparison between specific benchmark and its previous entry
 * @param id Benchmark ID to compare
 * @returns Comparison result containing current, previous, and delta information
 */
export function getBenchmarkComparison(id: string): {
  current: EnhancedBenchmarkEntry | null;
  previous: EnhancedBenchmarkEntry | null;
  delta: {
    overallScore: number;
    percentChange: number;
    phaseDeltas: Record<string, number>;
    newIssues: string[];
    resolvedIssues: string[];
    unchangedIssues: string[];
  } | null;
} {
  // Get the specified benchmark entry
  const current = benchmarkTracker.getEntryById(id);
  
  if (!current) {
    return { current: null, previous: null, delta: null };
  }
  
  // Find the previous entry for the same component/app
  const filter: BenchmarkFilter = {};
  
  if (current.summary.componentName) {
    filter.component = current.summary.componentName;
  }
  if (current.summary.appName) {
    filter.project = current.summary.appName;
  }
  
  // Get all entries matching the filter
  const entries = applyBenchmarkFilter(benchmarkTracker.getEntries(), filter);
  
  // Sort by timestamp (newest first)
  entries.sort((a, b) => b.timestamp - a.timestamp);
  
  // Find the current entry in the list and get the next one (previous chronologically)
  const currentIndex = entries.findIndex(e => e.id === id);
  
  if (currentIndex === -1 || currentIndex === entries.length - 1) {
    // Current entry not found or it's the oldest entry
    return {
      current: current as EnhancedBenchmarkEntry,
      previous: null,
      delta: null
    };
  }
  
  const previous = entries[currentIndex + 1];
  
  // Calculate delta between current and previous
  const delta = {
    overallScore: current.summary.overallScore - previous.summary.overallScore,
    percentChange: ((current.summary.overallScore - previous.summary.overallScore) / previous.summary.overallScore) * 100,
    phaseDeltas: calculatePhaseDeltas(current.summary, previous.summary),
    ...calculateIssueChanges(current.summary, previous.summary)
  };
  
  return {
    current: current as EnhancedBenchmarkEntry,
    previous: previous as EnhancedBenchmarkEntry,
    delta
  };
}

/**
 * Get overall benchmark trend data over time
 * @param limit Maximum number of data points
 * @param filter Filter options
 * @returns Trend data with timestamps and scores
 */
export function getBenchmarkTrend(
  limit = 20,
  filter: BenchmarkFilter = {}
): {
  timestamps: number[];
  scores: number[];
  components?: string[];
  projects?: string[];
} {
  // Get entries matching the filter
  const entries = applyBenchmarkFilter(benchmarkTracker.getEntries(), filter);
  
  // Sort by timestamp (oldest first for trend)
  entries.sort((a, b) => a.timestamp - b.timestamp);
  
  // Limit the number of entries
  const limitedEntries = entries.slice(-limit);
  
  // Extract timestamp and score data
  const timestamps = limitedEntries.map(e => e.timestamp);
  const scores = limitedEntries.map(e => e.summary.overallScore);
  
  // Get unique component and project names
  const components = [...new Set(limitedEntries.map(e => e.summary.componentName).filter(Boolean))];
  const projects = [...new Set(limitedEntries.map(e => e.summary.appName).filter(Boolean))];
  
  return { timestamps, scores, components, projects };
}

/**
 * Find regressions in benchmark history
 * @param threshold Minimum score decrease to consider as regression
 * @param filter Filter options
 * @returns Array of benchmark entries that show regressions
 */
export function findRegressions(
  threshold = 5,
  filter: BenchmarkFilter = {}
): EnhancedBenchmarkEntry[] {
  // Get enhanced entries with delta information
  const entries = enhanceEntriesWithDelta(
    applyBenchmarkFilter(benchmarkTracker.getEntries(), filter)
  );
  
  // Filter entries that show a regression beyond the threshold
  return entries.filter(entry => 
    entry.delta && entry.delta.overallScore <= -threshold
  );
}

// Private helper functions

/**
 * Apply filter to benchmark entries
 * @param entries Benchmark entries to filter
 * @param filter Filter options
 * @returns Filtered entries
 */
function applyBenchmarkFilter(
  entries: BenchmarkEntry[],
  filter: BenchmarkFilter
): BenchmarkEntry[] {
  return entries.filter(entry => {
    // Filter by project name
    if (filter.project && entry.summary.appName !== filter.project) {
      return false;
    }
    
    // Filter by component name
    if (filter.component && entry.summary.componentName !== filter.component) {
      return false;
    }
    
    // Filter by branch
    if (filter.branch && entry.branch !== filter.branch) {
      return false;
    }
    
    // Filter by date range
    if (filter.startDate && entry.timestamp < filter.startDate.getTime()) {
      return false;
    }
    if (filter.endDate && entry.timestamp > filter.endDate.getTime()) {
      return false;
    }
    
    // Filter by minimum score
    if (filter.minScore !== undefined && entry.summary.overallScore < filter.minScore) {
      return false;
    }
    
    return true;
  });
}

/**
 * Enhance entries with delta information
 * @param entries Benchmark entries to enhance
 * @returns Enhanced entries with delta information
 */
function enhanceEntriesWithDelta(entries: BenchmarkEntry[]): EnhancedBenchmarkEntry[] {
  // Map of component/app names to their previous entries
  const previousEntries = new Map<string, BenchmarkEntry>();
  
  // Enhanced entries
  const enhancedEntries: EnhancedBenchmarkEntry[] = [];
  
  // Process entries from oldest to newest
  [...entries].sort((a, b) => a.timestamp - b.timestamp).forEach(entry => {
    // Create a key based on component or app name
    const key = entry.summary.componentName || entry.summary.appName || 'unknown';
    
    // Get the previous entry for this component/app
    const previous = previousEntries.get(key);
    
    // Create an enhanced entry
    const enhancedEntry: EnhancedBenchmarkEntry = { ...entry };
    
    // Calculate delta if there's a previous entry
    if (previous) {
      enhancedEntry.delta = {
        overallScore: entry.summary.overallScore - previous.summary.overallScore,
        percentChange: ((entry.summary.overallScore - previous.summary.overallScore) / previous.summary.overallScore) * 100,
        phaseDeltas: calculatePhaseDeltas(entry.summary, previous.summary),
        ...calculateIssueChanges(entry.summary, previous.summary)
      };
    }
    
    // Add to the enhanced entries
    enhancedEntries.push(enhancedEntry);
    
    // Update the previous entry
    previousEntries.set(key, entry);
  });
  
  // Return entries sorted by timestamp (newest first)
  return enhancedEntries.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Calculate deltas between phase scores
 * @param current Current summary
 * @param previous Previous summary
 * @returns Phase deltas
 */
function calculatePhaseDeltas(
  current: UXEnhancementSummary,
  previous: UXEnhancementSummary
): Record<PhaseType, number> {
  const deltas: Record<PhaseType, number> = {} as Record<PhaseType, number>;
  
  // Ensure both summaries have phaseScores
  if (!current.phaseScores || !previous.phaseScores) {
    return deltas;
  }
  
  // Calculate delta for each phase
  Object.keys(current.phaseScores).forEach(phase => {
    const phaseType = phase as PhaseType;
    const currentScore = current.phaseScores?.[phaseType] || 0;
    const previousScore = previous.phaseScores?.[phaseType] || 0;
    
    deltas[phaseType] = currentScore - previousScore;
  });
  
  return deltas;
}

/**
 * Calculate issue changes between two summaries
 * @param current Current summary
 * @param previous Previous summary
 * @returns Issue changes
 */
function calculateIssueChanges(
  current: UXEnhancementSummary,
  previous: UXEnhancementSummary
): {
  newIssues: string[];
  resolvedIssues: string[];
  unchangedIssues: string[];
} {
  // Get issue messages for easier comparison
  const currentIssues = current.issues.map(issue => issue.message);
  const previousIssues = previous.issues.map(issue => issue.message);
  
  // Find new issues (in current but not in previous)
  const newIssues = currentIssues.filter(message => !previousIssues.includes(message));
  
  // Find resolved issues (in previous but not in current)
  const resolvedIssues = previousIssues.filter(message => !currentIssues.includes(message));
  
  // Find unchanged issues (in both)
  const unchangedIssues = currentIssues.filter(message => previousIssues.includes(message));
  
  return { newIssues, resolvedIssues, unchangedIssues };
}

// Exports for compatibility with existing code
export { BenchmarkTracker, BenchmarkEntry } from '../../lib/benchmarks/BenchmarkTracker'; 