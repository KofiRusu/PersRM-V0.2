"""
Chunk Indexing Module

This module implements a vector index for fast retrieval of text chunks based on
semantic similarity.
"""

import os
import json
import pickle
import logging
import time
import numpy as np
from enum import Enum
from typing import List, Dict, Optional, Any, Tuple, Union, Iterator, Callable
from dataclasses import dataclass, field, asdict

from src.longcontext.chunking import TextChunk

logger = logging.getLogger(__name__)

class IndexType(Enum):
    """Types of vector indices."""
    FAISS = "faiss"
    ANNOY = "annoy"
    MEMORY = "memory"  # In-memory simple index

@dataclass
class IndexMetadata:
    """Metadata for a chunk index."""
    name: str
    document_count: int = 0
    chunk_count: int = 0
    dimension: int = 0
    index_type: IndexType = IndexType.MEMORY
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    extra: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = asdict(self)
        result["index_type"] = self.index_type.value
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'IndexMetadata':
        """Create from dictionary."""
        if "index_type" in data and isinstance(data["index_type"], str):
            data = data.copy()
            data["index_type"] = IndexType(data["index_type"])
        return cls(**data)


class ChunkIndex:
    """Vector index for text chunks."""
    
    def __init__(
        self,
        name: str,
        dimension: int = 1536,
        index_type: IndexType = IndexType.MEMORY,
        storage_path: Optional[str] = None,
        embedding_provider: Optional[Callable[[str], List[float]]] = None,
        config: Dict[str, Any] = None
    ):
        """Initialize the chunk index.
        
        Args:
            name: Name of the index
            dimension: Dimension of embeddings
            index_type: Type of index to use
            storage_path: Path to store the index
            embedding_provider: Function to generate embeddings for chunks
            config: Additional configuration options
        """
        self.name = name
        self.dimension = dimension
        self.index_type = index_type
        self.storage_path = storage_path
        self.embedding_provider = embedding_provider
        self.config = config or {}
        
        # Initialize metadata
        self.metadata = IndexMetadata(
            name=name,
            dimension=dimension,
            index_type=index_type
        )
        
        # Initialize storage
        self._initialize_storage()
        
        # Load existing index if storage path is provided
        if storage_path and os.path.exists(os.path.join(storage_path, f"{name}.meta")):
            self.load()
    
    def _initialize_storage(self) -> None:
        """Initialize the vector index storage."""
        self.chunks: Dict[int, TextChunk] = {}
        self.document_ids: Dict[str, List[int]] = {}  # Maps document IDs to chunk IDs
        
        # Depending on the index type, initialize the appropriate index
        if self.index_type == IndexType.FAISS:
            try:
                import faiss
                self.index = faiss.IndexFlatL2(self.dimension)
                self.has_index = True
            except ImportError:
                logger.warning("FAISS not available. Falling back to memory index.")
                self.index_type = IndexType.MEMORY
                self.has_index = False
        
        elif self.index_type == IndexType.ANNOY:
            try:
                from annoy import AnnoyIndex
                self.index = AnnoyIndex(self.dimension, 'angular')
                self.has_index = True
            except ImportError:
                logger.warning("Annoy not available. Falling back to memory index.")
                self.index_type = IndexType.MEMORY
                self.has_index = False
        
        else:  # Memory index
            self.embeddings = []
            self.embedding_map = {}  # Maps chunk IDs to embedding indices
            self.has_index = False
    
    def add(self, chunks: List[TextChunk], document_id: Optional[str] = None) -> List[int]:
        """Add chunks to the index.
        
        Args:
            chunks: Chunks to add
            document_id: Optional document ID to associate with chunks
            
        Returns:
            List of chunk IDs that were added
        """
        if not chunks:
            return []
        
        # First, ensure all chunks have embeddings
        chunks_with_embeddings = []
        for chunk in chunks:
            if chunk.embedding is None and self.embedding_provider:
                # Generate embedding
                embedding = self.embedding_provider(chunk.text)
                chunk = chunk.with_embedding(embedding)
            
            if chunk.embedding is not None:
                chunks_with_embeddings.append(chunk)
        
        if not chunks_with_embeddings:
            logger.warning("No chunks with embeddings to add to index")
            return []
        
        # Get next chunk ID
        next_id = max(list(self.chunks.keys()) + [-1]) + 1
        chunk_ids = []
        
        # Add to index based on index type
        if self.index_type == IndexType.FAISS and self.has_index:
            # Convert embeddings to numpy array
            embeddings = np.array([chunk.embedding for chunk in chunks_with_embeddings], dtype=np.float32)
            
            # Add to FAISS index
            self.index.add(embeddings)
            
            # Add to chunk storage
            for i, chunk in enumerate(chunks_with_embeddings):
                chunk_id = next_id + i
                self.chunks[chunk_id] = chunk
                chunk_ids.append(chunk_id)
        
        elif self.index_type == IndexType.ANNOY and self.has_index:
            # Add to Annoy index
            for i, chunk in enumerate(chunks_with_embeddings):
                chunk_id = next_id + i
                self.index.add_item(len(self.chunks), chunk.embedding)
                self.chunks[chunk_id] = chunk
                chunk_ids.append(chunk_id)
            
            # Build index (required for Annoy after adding items)
            self.index.build(10)  # 10 trees - adjust based on size/accuracy tradeoff
        
        else:  # Memory index
            # Add to in-memory storage
            for i, chunk in enumerate(chunks_with_embeddings):
                chunk_id = next_id + i
                self.chunks[chunk_id] = chunk
                
                # Add to embeddings list
                embedding_idx = len(self.embeddings)
                self.embeddings.append(chunk.embedding)
                self.embedding_map[chunk_id] = embedding_idx
                
                chunk_ids.append(chunk_id)
        
        # Associate with document if provided
        if document_id:
            if document_id not in self.document_ids:
                self.document_ids[document_id] = []
            self.document_ids[document_id].extend(chunk_ids)
        
        # Update metadata
        self.metadata.chunk_count += len(chunk_ids)
        if document_id:
            self.metadata.document_count = len(self.document_ids)
        self.metadata.updated_at = time.time()
        
        return chunk_ids
    
    def search(
        self,
        query_embedding: List[float],
        k: int = 5,
        document_id: Optional[str] = None
    ) -> List[Tuple[int, float, TextChunk]]:
        """Search for chunks by embedding similarity.
        
        Args:
            query_embedding: Query embedding
            k: Number of results to return
            document_id: Optional document ID to limit search to
            
        Returns:
            List of (chunk_id, score, chunk) tuples
        """
        if not self.chunks:
            return []
        
        # Convert query to numpy array
        query_np = np.array([query_embedding], dtype=np.float32)
        
        # Filter to specific document if requested
        chunk_filter = None
        if document_id and document_id in self.document_ids:
            chunk_filter = set(self.document_ids[document_id])
        
        # Search based on index type
        if self.index_type == IndexType.FAISS and self.has_index:
            # Search in FAISS index
            k_search = min(k * 2, len(self.chunks)) if chunk_filter else k
            distances, indices = self.index.search(query_np, k_search)
            
            # Convert to chunk IDs and filter if needed
            results = []
            for i, (distance, idx) in enumerate(zip(distances[0], indices[0])):
                # Convert index to chunk ID (this is a simplification)
                chunk_id = list(self.chunks.keys())[idx] if idx < len(self.chunks) else -1
                
                if chunk_id >= 0 and (chunk_filter is None or chunk_id in chunk_filter):
                    results.append((chunk_id, float(distance), self.chunks[chunk_id]))
            
            # Limit to k results
            return results[:k]
        
        elif self.index_type == IndexType.ANNOY and self.has_index:
            # Search in Annoy index
            k_search = min(k * 2, len(self.chunks)) if chunk_filter else k
            indices, distances = self.index.get_nns_by_vector(
                query_embedding, k_search, include_distances=True
            )
            
            # Convert to chunk IDs and filter if needed
            results = []
            for idx, distance in zip(indices, distances):
                # Convert index to chunk ID
                chunk_id = list(self.chunks.keys())[idx] if idx < len(self.chunks) else -1
                
                if chunk_id >= 0 and (chunk_filter is None or chunk_id in chunk_filter):
                    # Convert distance to similarity score (Annoy returns angular distance)
                    similarity = 1.0 - distance
                    results.append((chunk_id, similarity, self.chunks[chunk_id]))
            
            # Limit to k results
            return results[:k]
        
        else:  # Memory index
            # Calculate similarity for all embeddings
            results = []
            
            # Filter chunk IDs if needed
            chunk_ids = list(self.chunks.keys())
            if chunk_filter:
                chunk_ids = [cid for cid in chunk_ids if cid in chunk_filter]
            
            for chunk_id in chunk_ids:
                # Get chunk and embedding
                chunk = self.chunks[chunk_id]
                
                if chunk.embedding:
                    # Calculate cosine similarity
                    embedding_np = np.array(chunk.embedding, dtype=np.float32)
                    similarity = np.dot(query_np[0], embedding_np) / (
                        np.linalg.norm(query_np[0]) * np.linalg.norm(embedding_np)
                    )
                    
                    results.append((chunk_id, float(similarity), chunk))
            
            # Sort by similarity (descending) and take top k
            results.sort(key=lambda x: x[1], reverse=True)
            return results[:k]
    
    def search_by_text(
        self,
        query_text: str,
        k: int = 5,
        document_id: Optional[str] = None
    ) -> List[Tuple[int, float, TextChunk]]:
        """Search for chunks by text query.
        
        Args:
            query_text: Text query
            k: Number of results to return
            document_id: Optional document ID to limit search to
            
        Returns:
            List of (chunk_id, score, chunk) tuples
        """
        if not self.embedding_provider:
            raise ValueError("No embedding provider available for text search")
        
        # Generate embedding for query
        query_embedding = self.embedding_provider(query_text)
        
        # Search by embedding
        return self.search(query_embedding, k, document_id)
    
    def get(self, chunk_id: int) -> Optional[TextChunk]:
        """Get a chunk by ID.
        
        Args:
            chunk_id: Chunk ID
            
        Returns:
            Chunk, or None if not found
        """
        return self.chunks.get(chunk_id)
    
    def get_by_document(self, document_id: str) -> List[TextChunk]:
        """Get all chunks for a document.
        
        Args:
            document_id: Document ID
            
        Returns:
            List of chunks
        """
        chunk_ids = self.document_ids.get(document_id, [])
        return [self.chunks[cid] for cid in chunk_ids if cid in self.chunks]
    
    def save(self, path: Optional[str] = None) -> None:
        """Save the index to disk.
        
        Args:
            path: Path to save to (defaults to self.storage_path)
        """
        save_path = path or self.storage_path
        if not save_path:
            raise ValueError("No storage path provided")
        
        os.makedirs(save_path, exist_ok=True)
        
        # Save metadata
        metadata_path = os.path.join(save_path, f"{self.name}.meta")
        with open(metadata_path, 'w') as f:
            json.dump(self.metadata.to_dict(), f)
        
        # Save chunks
        chunks_path = os.path.join(save_path, f"{self.name}.chunks")
        with open(chunks_path, 'wb') as f:
            pickle.dump(self.chunks, f)
        
        # Save document IDs
        doc_ids_path = os.path.join(save_path, f"{self.name}.docids")
        with open(doc_ids_path, 'wb') as f:
            pickle.dump(self.document_ids, f)
        
        # Save index based on type
        if self.index_type == IndexType.FAISS and self.has_index:
            import faiss
            index_path = os.path.join(save_path, f"{self.name}.faiss")
            faiss.write_index(self.index, index_path)
        
        elif self.index_type == IndexType.ANNOY and self.has_index:
            index_path = os.path.join(save_path, f"{self.name}.annoy")
            self.index.save(index_path)
        
        else:  # Memory index
            mem_path = os.path.join(save_path, f"{self.name}.mem")
            with open(mem_path, 'wb') as f:
                pickle.dump({
                    "embeddings": self.embeddings,
                    "embedding_map": self.embedding_map
                }, f)
    
    def load(self, path: Optional[str] = None) -> None:
        """Load the index from disk.
        
        Args:
            path: Path to load from (defaults to self.storage_path)
        """
        load_path = path or self.storage_path
        if not load_path:
            raise ValueError("No storage path provided")
        
        # Clear existing data
        self._initialize_storage()
        
        # Load metadata
        metadata_path = os.path.join(load_path, f"{self.name}.meta")
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata_dict = json.load(f)
                self.metadata = IndexMetadata.from_dict(metadata_dict)
                self.dimension = self.metadata.dimension
                self.index_type = self.metadata.index_type
        
        # Load chunks
        chunks_path = os.path.join(load_path, f"{self.name}.chunks")
        if os.path.exists(chunks_path):
            with open(chunks_path, 'rb') as f:
                self.chunks = pickle.load(f)
        
        # Load document IDs
        doc_ids_path = os.path.join(load_path, f"{self.name}.docids")
        if os.path.exists(doc_ids_path):
            with open(doc_ids_path, 'rb') as f:
                self.document_ids = pickle.load(f)
        
        # Load index based on type
        if self.index_type == IndexType.FAISS:
            import faiss
            index_path = os.path.join(load_path, f"{self.name}.faiss")
            if os.path.exists(index_path):
                self.index = faiss.read_index(index_path)
                self.has_index = True
        
        elif self.index_type == IndexType.ANNOY:
            from annoy import AnnoyIndex
            index_path = os.path.join(load_path, f"{self.name}.annoy")
            if os.path.exists(index_path):
                self.index = AnnoyIndex(self.dimension, 'angular')
                self.index.load(index_path)
                self.has_index = True
        
        else:  # Memory index
            mem_path = os.path.join(load_path, f"{self.name}.mem")
            if os.path.exists(mem_path):
                with open(mem_path, 'rb') as f:
                    mem_data = pickle.load(f)
                    self.embeddings = mem_data.get("embeddings", [])
                    self.embedding_map = mem_data.get("embedding_map", {}) 