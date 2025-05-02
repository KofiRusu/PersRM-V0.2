/**
 * Types for the memory module
 */

export interface MemoryEntry {
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface MemorySearchResult {
  content: string;
  metadata?: Record<string, any>;
  score: number;
  source: string;
}

export interface MemorySystemConfig {
  dimension?: number;
  indexType?: string;
  maxEntries?: number;
  storagePath?: string;
}

export interface MemoryManagerConfig {
  vectorDb?: {
    dimension: number;
    indexType: string;
  };
  maxEntries?: number;
}

export type EmbeddingProvider = (text: string) => Promise<number[]>; 