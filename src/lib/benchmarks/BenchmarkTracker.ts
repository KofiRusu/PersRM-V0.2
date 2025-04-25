import fs from 'fs-extra';
import path from 'path';
import { UXEnhancementSummary } from '../persrm/types';

export interface BenchmarkEntry {
  id: string;
  timestamp: string;
  commitSha?: string;
  author?: string;
  branch?: string;
  summary: UXEnhancementSummary;
}

export interface BenchmarkHistory {
  entries: BenchmarkEntry[];
  latestEntryId?: string;
}

export class BenchmarkTracker {
  private historyPath: string;
  private history: BenchmarkHistory;
  
  constructor(historyPath?: string) {
    this.historyPath = historyPath || path.resolve(process.cwd(), 'persrm-history.json');
    this.history = this.loadHistory();
  }
  
  /**
   * Load benchmark history from disk
   */
  private loadHistory(): BenchmarkHistory {
    try {
      if (fs.existsSync(this.historyPath)) {
        const data = fs.readJSONSync(this.historyPath);
        return data as BenchmarkHistory;
      }
    } catch (error) {
      console.error('Error loading benchmark history:', error);
    }
    
    // Return empty history if none exists or error occurs
    return { entries: [] };
  }
  
  /**
   * Save benchmark history to disk
   */
  private saveHistory(): void {
    try {
      fs.ensureDirSync(path.dirname(this.historyPath));
      fs.writeJSONSync(this.historyPath, this.history, { spaces: 2 });
    } catch (error) {
      console.error('Error saving benchmark history:', error);
    }
  }
  
  /**
   * Add a new benchmark entry
   */
  public addEntry(
    summary: UXEnhancementSummary, 
    metadata: { commitSha?: string; author?: string; branch?: string } = {}
  ): BenchmarkEntry {
    const entry: BenchmarkEntry = {
      id: `benchmark-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...metadata,
      summary
    };
    
    this.history.entries.push(entry);
    this.history.latestEntryId = entry.id;
    this.saveHistory();
    
    return entry;
  }
  
  /**
   * Get all benchmark entries
   */
  public getEntries(): BenchmarkEntry[] {
    return this.history.entries;
  }
  
  /**
   * Get the latest benchmark entry
   */
  public getLatestEntry(): BenchmarkEntry | null {
    if (!this.history.latestEntryId) {
      return this.history.entries.length > 0 
        ? this.history.entries[this.history.entries.length - 1] 
        : null;
    }
    
    return this.history.entries.find(entry => entry.id === this.history.latestEntryId) || null;
  }
  
  /**
   * Get benchmark entry by ID
   */
  public getEntryById(id: string): BenchmarkEntry | null {
    return this.history.entries.find(entry => entry.id === id) || null;
  }
  
  /**
   * Calculate score change between benchmark entries
   */
  public calculateScoreChange(currentId: string, previousId?: string): { 
    current: number;
    previous?: number;
    change?: number;
    percentChange?: number;
  } {
    const current = this.getEntryById(currentId);
    if (!current) {
      throw new Error(`Entry with id ${currentId} not found`);
    }
    
    const previousEntry = previousId 
      ? this.getEntryById(previousId)
      : this.getPreviousEntry(currentId);
      
    const currentScore = current.summary.overallScore;
    
    if (!previousEntry) {
      return { current: currentScore };
    }
    
    const previousScore = previousEntry.summary.overallScore;
    const change = currentScore - previousScore;
    const percentChange = (change / previousScore) * 100;
    
    return {
      current: currentScore,
      previous: previousScore,
      change,
      percentChange
    };
  }
  
  /**
   * Get previous benchmark entry
   */
  private getPreviousEntry(currentId: string): BenchmarkEntry | null {
    const currentIndex = this.history.entries.findIndex(entry => entry.id === currentId);
    
    if (currentIndex <= 0) {
      return null;
    }
    
    return this.history.entries[currentIndex - 1];
  }
  
  /**
   * Get benchmark trends over time
   */
  public getTrends(limit: number = 10): {
    timestamps: string[];
    scores: number[];
    components: string[];
    issuesCounts: number[];
  } {
    const entries = [...this.history.entries]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-limit);
    
    return {
      timestamps: entries.map(entry => entry.timestamp),
      scores: entries.map(entry => entry.summary.overallScore),
      components: entries.map(entry => entry.summary.componentName || ''),
      issuesCounts: entries.map(entry => entry.summary.issues.length)
    };
  }
  
  /**
   * Get detailed component history for a specific component
   */
  public getComponentHistory(componentName: string): BenchmarkEntry[] {
    return this.history.entries.filter(
      entry => entry.summary.componentName === componentName
    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
  
  /**
   * Clear all benchmark history
   */
  public clearHistory(): void {
    this.history = { entries: [] };
    this.saveHistory();
  }
} 