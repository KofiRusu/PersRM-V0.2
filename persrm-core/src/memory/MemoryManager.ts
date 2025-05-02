/**
 * Memory Manager
 * 
 * Manages memory systems and provides a unified interface for memory operations.
 */

import * as path from 'path';
import { 
  EmbeddingProvider, 
  MemoryManagerConfig, 
  MemorySearchResult, 
  MemorySystemConfig 
} from './types';
import { MemorySystem } from './MemorySystem';

export class MemoryManager {
  private config: MemoryManagerConfig;
  private embeddingProvider?: EmbeddingProvider;
  private shortTerm: MemorySystem;
  private longTerm: MemorySystem;
  
  constructor(
    config: MemoryManagerConfig = {},
    embeddingProvider?: EmbeddingProvider
  ) {
    this.config = config;
    this.embeddingProvider = embeddingProvider;
    
    // Initialize memory systems
    this.shortTerm = new MemorySystem({
      dimension: config.vectorDb?.dimension || 1536,
      maxEntries: 1000,
      // Short-term memory is not persisted
    });
    
    this.longTerm = new MemorySystem({
      dimension: config.vectorDb?.dimension || 1536,
      indexType: config.vectorDb?.indexType || 'L2',
      maxEntries: config.maxEntries || 100000,
      storagePath: path.join(process.cwd(), 'data', 'memory', 'long_term.json')
    });
  }
  
  /**
   * Add content to memory
   */
  async add(
    content: string,
    longTerm: boolean = false,
    metadata?: Record<string, any>
  ): Promise<number> {
    // Generate embedding if embedding provider is available
    let embedding;
    if (this.embeddingProvider) {
      embedding = await this.embeddingProvider(content);
    }
    
    // Add to appropriate memory system
    if (longTerm) {
      return this.longTerm.add(content, embedding, metadata);
    } else {
      return this.shortTerm.add(content, embedding, metadata);
    }
  }
  
  /**
   * Search for similar content
   */
  async search(
    query: string,
    options: {
      k?: number;
      includeShortTerm?: boolean;
      includeLongTerm?: boolean;
    } = {}
  ): Promise<MemorySearchResult[]> {
    const {
      k = 5,
      includeShortTerm = true,
      includeLongTerm = true
    } = options;
    
    if (!this.embeddingProvider) {
      return [];
    }
    
    // Generate query embedding
    const queryEmbedding = await this.embeddingProvider(query);
    
    const results: MemorySearchResult[] = [];
    
    // Search short-term memory
    if (includeShortTerm) {
      const shortTermResults = this.shortTerm.search(queryEmbedding, k);
      for (const [idx, score] of shortTermResults) {
        const entry = this.shortTerm.get(idx);
        results.push({
          content: entry.content,
          metadata: entry.metadata,
          score,
          source: "short_term"
        });
      }
    }
    
    // Search long-term memory
    if (includeLongTerm) {
      const longTermResults = this.longTerm.search(queryEmbedding, k);
      for (const [idx, score] of longTermResults) {
        const entry = this.longTerm.get(idx);
        results.push({
          content: entry.content,
          metadata: entry.metadata,
          score,
          source: "long_term"
        });
      }
    }
    
    // Sort by score (descending) and return top k
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }
  
  /**
   * Move important short-term memories to long-term
   */
  consolidate(): void {
    // For now, we'll just move everything
    // TODO: Implement strategy for determining which memories to keep
    for (let i = 0; i < this.shortTerm.size; i++) {
      try {
        const entry = this.shortTerm.get(i);
        this.longTerm.add(
          entry.content,
          entry.embedding,
          entry.metadata
        );
      } catch (e) {
        console.error(`Error consolidating memory at index ${i}:`, e);
      }
    }
    
    // Clear short-term memory by creating a new instance
    this.shortTerm = new MemorySystem({
      dimension: this.config.vectorDb?.dimension || 1536,
      maxEntries: 1000
    });
  }
  
  /**
   * Save memory systems to disk
   */
  save(): void {
    // Only long-term memory is persisted
    this.longTerm.save();
  }
  
  /**
   * Get the short-term memory system
   */
  getShortTermMemory(): MemorySystem {
    return this.shortTerm;
  }
  
  /**
   * Get the long-term memory system
   */
  getLongTermMemory(): MemorySystem {
    return this.longTerm;
  }
  
  /**
   * Set the embedding provider
   */
  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }
} 