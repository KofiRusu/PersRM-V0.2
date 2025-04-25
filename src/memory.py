"""
Memory Module for PersLM

This module implements the memory system for PersLM, enabling context persistence
across interactions. It provides interfaces for:
1. Storing and retrieving embeddings in a vector database
2. Managing memory entries with different priority levels
3. Implementing forgetting mechanisms to optimize memory usage

Future enhancements:
- Advanced retrieval strategies (temporal, semantic, episodic)
- Integration with external knowledge bases
- Multi-modal memory support
"""

import os
import json
import time
import numpy as np
from typing import Dict, List, Optional, Union, Any, Tuple
from dataclasses import dataclass

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    print("Warning: FAISS not available. Using simple memory storage instead.")

@dataclass
class MemoryEntry:
    """A single entry in the memory system."""
    content: str
    embedding: Optional[np.ndarray] = None
    metadata: Dict[str, Any] = None
    timestamp: float = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()
        if self.metadata is None:
            self.metadata = {}

class MemorySystem:
    """Memory system for context persistence."""
    
    def __init__(
        self, 
        dimension: int = 4096,
        index_type: str = "L2",
        max_entries: int = 100000,
        storage_path: Optional[str] = None
    ):
        """Initialize memory system.
        
        Args:
            dimension: Dimension of embeddings
            index_type: Type of FAISS index (L2, IP, etc.)
            max_entries: Maximum number of entries to store
            storage_path: Path to save/load memory from disk
        """
        self.dimension = dimension
        self.index_type = index_type
        self.max_entries = max_entries
        self.storage_path = storage_path
        
        # Initialize storage
        self._initialize_storage()
        
        # Load existing memory if storage path is provided
        if storage_path and os.path.exists(storage_path):
            self.load()
    
    def _initialize_storage(self):
        """Initialize the storage backend."""
        self.entries = []
        self.content_map = {}  # Maps content hash to entry index
        
        if FAISS_AVAILABLE:
            if self.index_type == "L2":
                self.index = faiss.IndexFlatL2(self.dimension)
            elif self.index_type == "IP":
                self.index = faiss.IndexFlatIP(self.dimension)
            else:
                raise ValueError(f"Unknown index type: {self.index_type}")
        else:
            # Simple fallback storage when FAISS is not available
            self.index = None
    
    def add(
        self, 
        content: str, 
        embedding: Optional[np.ndarray] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """Add an entry to memory.
        
        Args:
            content: Text content to add to memory
            embedding: Embedding vector for the content
            metadata: Additional metadata for the entry
            
        Returns:
            Index of the added entry
        """
        # Check if content already exists
        content_hash = hash(content)
        if content_hash in self.content_map:
            return self.content_map[content_hash]
        
        # Create new entry
        entry = MemoryEntry(
            content=content,
            embedding=embedding,
            metadata=metadata or {}
        )
        
        # Add to entries list
        index = len(self.entries)
        self.entries.append(entry)
        self.content_map[content_hash] = index
        
        # Add to vector index if available
        if FAISS_AVAILABLE and embedding is not None:
            self.index.add(np.array([embedding], dtype=np.float32))
        
        # Manage memory if exceeded max entries
        if len(self.entries) > self.max_entries:
            self._forget_oldest()
        
        return index
    
    def _forget_oldest(self, count: int = 1):
        """Forget the oldest entries in memory.
        
        Args:
            count: Number of entries to forget
        """
        # Sort entries by timestamp (oldest first)
        sorted_indices = sorted(
            range(len(self.entries)), 
            key=lambda i: self.entries[i].timestamp
        )
        
        # Remove oldest entries
        to_remove = sorted_indices[:count]
        for idx in sorted(to_remove, reverse=True):
            content_hash = hash(self.entries[idx].content)
            del self.content_map[content_hash]
            del self.entries[idx]
        
        # Rebuild FAISS index if available
        if FAISS_AVAILABLE and self.index is not None:
            self._rebuild_index()
    
    def _rebuild_index(self):
        """Rebuild the FAISS index from scratch."""
        self._initialize_storage()
        embeddings = []
        
        for entry in self.entries:
            if entry.embedding is not None:
                embeddings.append(entry.embedding)
        
        if embeddings:
            self.index.add(np.array(embeddings, dtype=np.float32))
    
    def search(
        self, 
        query_embedding: np.ndarray, 
        k: int = 5
    ) -> List[Tuple[int, float]]:
        """Search for similar entries.
        
        Args:
            query_embedding: Query embedding vector
            k: Number of results to return
            
        Returns:
            List of (entry_index, similarity_score) tuples
        """
        if not FAISS_AVAILABLE or self.index is None:
            # Fallback to simple cosine similarity
            results = []
            for i, entry in enumerate(self.entries):
                if entry.embedding is not None:
                    similarity = np.dot(query_embedding, entry.embedding) / (
                        np.linalg.norm(query_embedding) * np.linalg.norm(entry.embedding)
                    )
                    results.append((i, float(similarity)))
            
            return sorted(results, key=lambda x: x[1], reverse=True)[:k]
        
        # Use FAISS for search
        k = min(k, len(self.entries))
        if k == 0:
            return []
        
        distances, indices = self.index.search(
            np.array([query_embedding], dtype=np.float32), k
        )
        
        return [(int(idx), float(dist)) for idx, dist in zip(indices[0], distances[0])]
    
    def get(self, index: int) -> MemoryEntry:
        """Get an entry by index.
        
        Args:
            index: Index of the entry to retrieve
            
        Returns:
            The memory entry
        """
        return self.entries[index]
    
    def save(self, path: Optional[str] = None):
        """Save memory to disk.
        
        Args:
            path: Path to save memory to (defaults to self.storage_path)
        """
        save_path = path or self.storage_path
        if save_path is None:
            raise ValueError("No storage path provided")
        
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        # Serialize entries
        serialized = []
        for entry in self.entries:
            serialized.append({
                "content": entry.content,
                "embedding": entry.embedding.tolist() if entry.embedding is not None else None,
                "metadata": entry.metadata,
                "timestamp": entry.timestamp
            })
        
        # Save to disk
        with open(save_path, 'w') as f:
            json.dump(serialized, f)
    
    def load(self, path: Optional[str] = None):
        """Load memory from disk.
        
        Args:
            path: Path to load memory from (defaults to self.storage_path)
        """
        load_path = path or self.storage_path
        if load_path is None:
            raise ValueError("No storage path provided")
        
        if not os.path.exists(load_path):
            return
        
        # Clear existing memory
        self._initialize_storage()
        
        # Load from disk
        with open(load_path, 'r') as f:
            serialized = json.load(f)
        
        # Deserialize entries
        for item in serialized:
            embedding = None
            if item["embedding"] is not None:
                embedding = np.array(item["embedding"], dtype=np.float32)
            
            entry = MemoryEntry(
                content=item["content"],
                embedding=embedding,
                metadata=item["metadata"],
                timestamp=item["timestamp"]
            )
            
            index = len(self.entries)
            self.entries.append(entry)
            self.content_map[hash(entry.content)] = index
            
            # Add to vector index if available
            if FAISS_AVAILABLE and embedding is not None:
                self.index.add(np.array([embedding], dtype=np.float32))


class MemoryManager:
    """Manages memory systems and provides a unified interface."""
    
    def __init__(
        self,
        config: Dict[str, Any],
        embedding_provider=None
    ):
        """Initialize the memory manager.
        
        Args:
            config: Memory configuration
            embedding_provider: Function that returns embeddings for text
        """
        self.config = config
        self.embedding_provider = embedding_provider
        
        # Initialize memory systems
        self.short_term = MemorySystem(
            dimension=config.get("vector_db", {}).get("dimension", 4096),
            max_entries=1000,
            storage_path=None  # Short-term memory is not persisted
        )
        
        self.long_term = MemorySystem(
            dimension=config.get("vector_db", {}).get("dimension", 4096),
            index_type=config.get("vector_db", {}).get("index_type", "L2"),
            max_entries=config.get("max_entries", 100000),
            storage_path=os.path.join("data", "memory", "long_term.json")
        )
    
    def add(
        self, 
        content: str, 
        long_term: bool = False,
        metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """Add content to memory.
        
        Args:
            content: Text content to add
            long_term: Whether to add to long-term memory
            metadata: Additional metadata
            
        Returns:
            Index in the appropriate memory system
        """
        # Generate embedding if embedding provider is available
        embedding = None
        if self.embedding_provider is not None:
            embedding = self.embedding_provider(content)
        
        # Add to appropriate memory system
        if long_term:
            return self.long_term.add(content, embedding, metadata)
        else:
            return self.short_term.add(content, embedding, metadata)
    
    def search(
        self, 
        query: str,
        k: int = 5,
        include_short_term: bool = True,
        include_long_term: bool = True
    ) -> List[Dict[str, Any]]:
        """Search for similar content.
        
        Args:
            query: Query text
            k: Number of results to return
            include_short_term: Whether to search short-term memory
            include_long_term: Whether to search long-term memory
            
        Returns:
            List of search results with content and metadata
        """
        if self.embedding_provider is None:
            return []
        
        # Generate query embedding
        query_embedding = self.embedding_provider(query)
        
        results = []
        
        # Search short-term memory
        if include_short_term:
            short_term_results = self.short_term.search(query_embedding, k)
            for idx, score in short_term_results:
                entry = self.short_term.get(idx)
                results.append({
                    "content": entry.content,
                    "metadata": entry.metadata,
                    "score": score,
                    "source": "short_term"
                })
        
        # Search long-term memory
        if include_long_term:
            long_term_results = self.long_term.search(query_embedding, k)
            for idx, score in long_term_results:
                entry = self.long_term.get(idx)
                results.append({
                    "content": entry.content,
                    "metadata": entry.metadata,
                    "score": score,
                    "source": "long_term"
                })
        
        # Sort by score (descending) and return top k
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:k]
    
    def consolidate(self):
        """Move important short-term memories to long-term."""
        # TODO: Implement strategy for determining which memories to keep
        # For now, we'll just move everything
        for entry in self.short_term.entries:
            self.long_term.add(
                entry.content,
                entry.embedding,
                entry.metadata
            )
        
        # Clear short-term memory
        self.short_term = MemorySystem(
            dimension=self.config.get("vector_db", {}).get("dimension", 4096),
            max_entries=1000
        )
    
    def save(self):
        """Save memory systems to disk."""
        # Only long-term memory is persisted
        self.long_term.save() 