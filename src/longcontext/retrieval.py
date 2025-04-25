"""
Chunk Retrieval Module

This module implements retrieval mechanisms for finding and fetching relevant text chunks
based on queries and context.
"""

import logging
import heapq
from typing import List, Dict, Optional, Any, Tuple, Callable, Set, Union
from dataclasses import dataclass, field

from src.longcontext.chunking import TextChunk
from src.longcontext.indexing import ChunkIndex

logger = logging.getLogger(__name__)

@dataclass
class RetrievalResult:
    """Result of a retrieval operation."""
    chunks: List[TextChunk] = field(default_factory=list)
    scores: Dict[int, float] = field(default_factory=dict)  # Maps chunk index to relevance score
    query: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def count(self) -> int:
        """Get the number of chunks retrieved."""
        return len(self.chunks)
    
    @property
    def total_size(self) -> int:
        """Get the total size of all chunks in characters."""
        return sum(chunk.size for chunk in self.chunks)
    
    @property
    def total_tokens(self) -> int:
        """Get the estimated total number of tokens."""
        return sum(chunk.estimated_tokens for chunk in self.chunks)
    
    def get_sorted_chunks(self) -> List[Tuple[TextChunk, float]]:
        """Get chunks sorted by relevance score (highest first)."""
        scored_chunks = [(chunk, self.scores.get(chunk.index, 0.0)) for chunk in self.chunks]
        return sorted(scored_chunks, key=lambda x: x[1], reverse=True)
    
    def get_text(self, separator: str = "\n\n", include_scores: bool = False) -> str:
        """Get the combined text of all chunks.
        
        Args:
            separator: Separator between chunks
            include_scores: Whether to include relevance scores
            
        Returns:
            Combined text
        """
        if include_scores:
            sorted_chunks = self.get_sorted_chunks()
            texts = [f"{chunk.text}\n[Relevance: {score:.2f}]" for chunk, score in sorted_chunks]
        else:
            texts = [chunk.text for chunk in self.chunks]
        
        return separator.join(texts)
    
    def filter_by_score(self, min_score: float) -> 'RetrievalResult':
        """Filter chunks by minimum score.
        
        Args:
            min_score: Minimum relevance score
            
        Returns:
            New RetrievalResult with filtered chunks
        """
        filtered_chunks = []
        filtered_scores = {}
        
        for chunk in self.chunks:
            score = self.scores.get(chunk.index, 0.0)
            if score >= min_score:
                filtered_chunks.append(chunk)
                filtered_scores[chunk.index] = score
        
        return RetrievalResult(
            chunks=filtered_chunks,
            scores=filtered_scores,
            query=self.query,
            metadata=self.metadata.copy()
        )
    
    def limit_tokens(self, max_tokens: int) -> 'RetrievalResult':
        """Limit the total number of tokens, keeping highest scored chunks.
        
        Args:
            max_tokens: Maximum number of tokens
            
        Returns:
            New RetrievalResult with limited chunks
        """
        if self.total_tokens <= max_tokens:
            return self
        
        # Sort chunks by score
        sorted_chunks = self.get_sorted_chunks()
        
        # Add chunks until we hit the token limit
        limited_chunks = []
        limited_scores = {}
        total_tokens = 0
        
        for chunk, score in sorted_chunks:
            if total_tokens + chunk.estimated_tokens <= max_tokens:
                limited_chunks.append(chunk)
                limited_scores[chunk.index] = score
                total_tokens += chunk.estimated_tokens
            else:
                break
        
        return RetrievalResult(
            chunks=limited_chunks,
            scores=limited_scores,
            query=self.query,
            metadata=self.metadata.copy()
        )


class ChunkRetriever:
    """Retriever for finding relevant chunks based on queries."""
    
    def __init__(
        self, 
        index: ChunkIndex,
        embedding_provider: Optional[Callable[[str], List[float]]] = None,
        config: Dict[str, Any] = None
    ):
        """Initialize the chunk retriever.
        
        Args:
            index: Vector index for chunks
            embedding_provider: Function to generate embeddings for queries
            config: Additional configuration options
        """
        self.index = index
        self.embedding_provider = embedding_provider or index.embedding_provider
        self.config = config or {}
        
        # Configuration options
        self.default_top_k = self.config.get("default_top_k", 5)
        self.min_score_threshold = self.config.get("min_score_threshold", 0.6)
        self.use_reranker = self.config.get("use_reranker", False)
        self.reranker = None
    
    def retrieve(
        self, 
        query: str, 
        k: int = None,
        document_id: Optional[str] = None,
        min_score: Optional[float] = None,
        rerank: bool = None,
        filter_fn: Optional[Callable[[TextChunk], bool]] = None
    ) -> RetrievalResult:
        """Retrieve chunks relevant to a query.
        
        Args:
            query: Query text
            k: Number of chunks to retrieve (default: self.default_top_k)
            document_id: Optional document ID to restrict search to
            min_score: Minimum relevance score (default: self.min_score_threshold)
            rerank: Whether to rerank results (default: self.use_reranker)
            filter_fn: Optional function to filter chunks
            
        Returns:
            Retrieval result
        """
        if not query:
            return RetrievalResult(query=query)
        
        # Use default values if not specified
        if k is None:
            k = self.default_top_k
        if min_score is None:
            min_score = self.min_score_threshold
        if rerank is None:
            rerank = self.use_reranker
        
        # Get embedding-based search results
        search_results = self._vector_search(query, k, document_id)
        
        # Filter by minimum score
        filtered_results = [(chunk_id, score, chunk) for chunk_id, score, chunk in search_results if score >= min_score]
        
        # Apply custom filter if provided
        if filter_fn:
            filtered_results = [(chunk_id, score, chunk) for chunk_id, score, chunk in filtered_results if filter_fn(chunk)]
        
        # Rerank if requested
        if rerank and self.reranker and filtered_results:
            filtered_results = self._rerank_results(query, filtered_results)
        
        # Create retrieval result
        chunks = [chunk for _, _, chunk in filtered_results]
        scores = {chunk.index: score for _, score, chunk in filtered_results}
        
        return RetrievalResult(
            chunks=chunks,
            scores=scores,
            query=query,
            metadata={
                "document_id": document_id,
                "k": k,
                "min_score": min_score,
                "reranked": rerank
            }
        )
    
    def _vector_search(
        self, 
        query: str, 
        k: int, 
        document_id: Optional[str] = None
    ) -> List[Tuple[int, float, TextChunk]]:
        """Perform vector search using the index.
        
        Args:
            query: Query text
            k: Number of results to return
            document_id: Optional document ID to restrict search to
            
        Returns:
            List of (chunk_id, score, chunk) tuples
        """
        # Use the index's search_by_text method if embedding provider is available
        if self.embedding_provider:
            return self.index.search_by_text(query, k, document_id)
        else:
            logger.warning("No embedding provider available. Vector search not possible.")
            return []
    
    def _rerank_results(
        self, 
        query: str, 
        results: List[Tuple[int, float, TextChunk]]
    ) -> List[Tuple[int, float, TextChunk]]:
        """Rerank search results using a more expensive/accurate method.
        
        This is a placeholder for cross-encoder reranking. In a real implementation,
        this would use a separate reranking model.
        
        Args:
            query: Query text
            results: Initial search results
            
        Returns:
            Reranked results
        """
        # If no reranker is available, return original results
        if not self.reranker:
            return results
        
        # In a real implementation, this would pass the results to a reranker
        # For now, we just return the original results
        return results
    
    def retrieve_multi_query(
        self, 
        queries: List[str], 
        k_per_query: int = None,
        max_chunks: int = None,
        document_id: Optional[str] = None,
        min_score: Optional[float] = None,
        dedup: bool = True
    ) -> RetrievalResult:
        """Retrieve chunks using multiple queries.
        
        This implements a query expansion approach, where multiple variants of
        a query are used to improve retrieval.
        
        Args:
            queries: List of query strings
            k_per_query: Number of chunks to retrieve per query (default: self.default_top_k)
            max_chunks: Maximum total chunks to return (default: k_per_query * len(queries))
            document_id: Optional document ID to restrict search to
            min_score: Minimum relevance score (default: self.min_score_threshold)
            dedup: Whether to deduplicate results across queries
            
        Returns:
            Retrieval result
        """
        if not queries:
            return RetrievalResult()
        
        # Use default values if not specified
        if k_per_query is None:
            k_per_query = self.default_top_k
        if max_chunks is None:
            max_chunks = k_per_query * len(queries)
        if min_score is None:
            min_score = self.min_score_threshold
        
        # Track seen chunk IDs for deduplication
        seen_chunk_ids = set()
        all_results = []
        
        # Retrieve for each query
        for query in queries:
            # Get results for this query
            results = self._vector_search(query, k_per_query, document_id)
            
            # Filter by score
            results = [(chunk_id, score, chunk) for chunk_id, score, chunk in results if score >= min_score]
            
            # Deduplicate if requested
            if dedup:
                filtered_results = []
                for chunk_id, score, chunk in results:
                    if chunk_id not in seen_chunk_ids:
                        seen_chunk_ids.add(chunk_id)
                        filtered_results.append((chunk_id, score, chunk))
                results = filtered_results
            
            all_results.extend(results)
        
        # Sort all results by score and take top max_chunks
        all_results.sort(key=lambda x: x[1], reverse=True)
        top_results = all_results[:max_chunks]
        
        # Create retrieval result
        chunks = [chunk for _, _, chunk in top_results]
        scores = {chunk.index: score for _, score, chunk in top_results}
        
        return RetrievalResult(
            chunks=chunks,
            scores=scores,
            query="; ".join(queries),
            metadata={
                "document_id": document_id,
                "queries": queries,
                "k_per_query": k_per_query,
                "max_chunks": max_chunks,
                "min_score": min_score
            }
        )
    
    def retrieve_hybrid(
        self,
        query: str,
        k: int = None,
        document_id: Optional[str] = None,
        keyword_weight: float = 0.3
    ) -> RetrievalResult:
        """Retrieve chunks using a hybrid approach of vector and keyword search.
        
        This is a simple implementation that combines vector search with basic
        keyword matching. In a real implementation, this would use a more
        sophisticated hybrid retrieval approach.
        
        Args:
            query: Query text
            k: Number of chunks to retrieve (default: self.default_top_k)
            document_id: Optional document ID to restrict search to
            keyword_weight: Weight for keyword search (0.0 - 1.0)
            
        Returns:
            Retrieval result
        """
        if not query:
            return RetrievalResult(query=query)
        
        # Use default values if not specified
        if k is None:
            k = self.default_top_k
        
        # Get vector search results
        vector_results = self._vector_search(query, k * 2, document_id)
        
        # If no embedding provider, fall back to keyword search
        if not vector_results:
            return self._keyword_search(query, k, document_id)
        
        # Perform keyword search for the same query
        keyword_results = self._keyword_search(query, k * 2, document_id)
        
        # Combine results with weighted scores
        # Create a dictionary mapping chunk_id to (vector_score, keyword_score)
        combined_scores = {}
        
        # Add vector scores
        for chunk_id, score, chunk in vector_results:
            combined_scores[chunk_id] = ((1.0 - keyword_weight) * score, 0.0, chunk)
        
        # Add keyword scores
        for chunk_id, score, chunk in keyword_results:
            if chunk_id in combined_scores:
                vector_score, _, chunk = combined_scores[chunk_id]
                combined_scores[chunk_id] = (vector_score, keyword_weight * score, chunk)
            else:
                combined_scores[chunk_id] = (0.0, keyword_weight * score, chunk)
        
        # Calculate final scores
        final_results = []
        for chunk_id, (vector_score, keyword_score, chunk) in combined_scores.items():
            final_score = vector_score + keyword_score
            final_results.append((chunk_id, final_score, chunk))
        
        # Sort by final score and take top k
        final_results.sort(key=lambda x: x[1], reverse=True)
        top_results = final_results[:k]
        
        # Create retrieval result
        chunks = [chunk for _, _, chunk in top_results]
        scores = {chunk.index: score for _, score, chunk in top_results}
        
        return RetrievalResult(
            chunks=chunks,
            scores=scores,
            query=query,
            metadata={
                "document_id": document_id,
                "k": k,
                "keyword_weight": keyword_weight,
                "hybrid": True
            }
        )
    
    def _keyword_search(
        self, 
        query: str, 
        k: int, 
        document_id: Optional[str] = None
    ) -> List[Tuple[int, float, TextChunk]]:
        """Perform keyword-based search.
        
        This is a simple implementation that uses basic keyword matching.
        In a real implementation, this would use a proper text search index.
        
        Args:
            query: Query text
            k: Number of results to return
            document_id: Optional document ID to restrict search to
            
        Returns:
            List of (chunk_id, score, chunk) tuples
        """
        # Simple implementation: score chunks based on keyword matches
        results = []
        
        # Get all chunks, possibly filtered by document ID
        chunks = []
        if document_id:
            chunks = self.index.get_by_document(document_id)
        else:
            chunks = list(self.index.chunks.values())
        
        # Split query into keywords
        keywords = [kw.lower() for kw in query.split() if len(kw) > 2]
        if not keywords:
            return []
        
        # Score each chunk based on keyword matches
        for chunk in chunks:
            text_lower = chunk.text.lower()
            
            # Count keyword matches
            matches = sum(1 for kw in keywords if kw in text_lower)
            
            # Calculate score based on match ratio
            if matches > 0:
                score = matches / len(keywords)
                results.append((chunk.index, score, chunk))
        
        # Sort by score and limit to top k
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:k] 