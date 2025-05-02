/**
 * Memory System
 * 
 * Handles the storage and retrieval of memories with vector embeddings.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { MemoryEntry, MemorySystemConfig } from './types';

export class MemorySystem {
  private dimension: number;
  private indexType: string;
  private maxEntries: number;
  private storagePath?: string;
  
  private entries: MemoryEntry[] = [];
  private contentMap: Map<string, number> = new Map();
  
  constructor(config: MemorySystemConfig = {}) {
    this.dimension = config.dimension || 1536;
    this.indexType = config.indexType || 'L2';
    this.maxEntries = config.maxEntries || 100000;
    this.storagePath = config.storagePath;
    
    // Load existing memory if storage path is provided
    if (this.storagePath && fs.existsSync(this.storagePath)) {
      this.load();
    }
  }
  
  /**
   * Add an entry to memory
   */
  add(
    content: string, 
    embedding?: number[], 
    metadata?: Record<string, any>
  ): number {
    // Check if content already exists (using a simple hash)
    const contentHash = this.hashContent(content);
    if (this.contentMap.has(contentHash)) {
      return this.contentMap.get(contentHash)!;
    }
    
    // Create new entry
    const entry: MemoryEntry = {
      content,
      embedding,
      metadata,
      timestamp: Date.now()
    };
    
    // Add to entries list
    const index = this.entries.length;
    this.entries.push(entry);
    this.contentMap.set(contentHash, index);
    
    // Manage memory if exceeded max entries
    if (this.entries.length > this.maxEntries) {
      this.forgetOldest();
    }
    
    return index;
  }
  
  /**
   * Forget the oldest entries in memory
   */
  private forgetOldest(count: number = 1): void {
    // Sort entries by timestamp (oldest first)
    const sortedIndices = Array.from(Array(this.entries.length).keys())
      .sort((a, b) => this.entries[a].timestamp - this.entries[b].timestamp);
    
    // Remove oldest entries
    const toRemove = sortedIndices.slice(0, count);
    for (const idx of toRemove.sort((a, b) => b - a)) {
      const contentHash = this.hashContent(this.entries[idx].content);
      this.contentMap.delete(contentHash);
      this.entries.splice(idx, 1);
      
      // Update content map indices for all entries with index > idx
      for (const [hash, index] of this.contentMap.entries()) {
        if (index > idx) {
          this.contentMap.set(hash, index - 1);
        }
      }
    }
  }
  
  /**
   * Search for similar entries (simple cosine similarity implementation)
   */
  search(queryEmbedding: number[], k: number = 5): Array<[number, number]> {
    if (!queryEmbedding) {
      return [];
    }
    
    const results: Array<[number, number]> = [];
    
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (entry.embedding) {
        const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
        results.push([i, similarity]);
      }
    }
    
    // Sort by similarity (descending) and return top k
    return results
      .sort((a, b) => b[1] - a[1])
      .slice(0, k);
  }
  
  /**
   * Get an entry by index
   */
  get(index: number): MemoryEntry {
    return this.entries[index];
  }
  
  /**
   * Save memory to disk
   */
  save(path?: string): void {
    const savePath = path || this.storagePath;
    if (!savePath) {
      throw new Error("No storage path provided");
    }
    
    // Create directory if it doesn't exist
    fs.mkdirpSync(path.dirname(savePath));
    
    // Serialize and save entries
    fs.writeJsonSync(savePath, this.entries, { spaces: 2 });
  }
  
  /**
   * Load memory from disk
   */
  load(path?: string): void {
    const loadPath = path || this.storagePath;
    if (!loadPath) {
      throw new Error("No storage path provided");
    }
    
    if (!fs.existsSync(loadPath)) {
      return;
    }
    
    // Clear existing memory
    this.entries = [];
    this.contentMap.clear();
    
    // Load entries
    const entries = fs.readJsonSync(loadPath) as MemoryEntry[];
    
    // Add each entry
    for (const entry of entries) {
      const index = this.entries.length;
      this.entries.push(entry);
      this.contentMap.set(this.hashContent(entry.content), index);
    }
  }
  
  /**
   * Create a simple hash of content for deduplication
   */
  private hashContent(content: string): string {
    return content.trim().toLowerCase();
  }
  
  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same dimension");
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  /**
   * Get the number of entries in memory
   */
  get size(): number {
    return this.entries.length;
  }
} 