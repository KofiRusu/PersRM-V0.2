"""
Long Context Manager

This module implements the context manager for handling documents and
conversations that exceed the model's context window size through integrated
chunking, retrieval, and summarization.
"""

import os
import json
import logging
import time
from typing import List, Dict, Optional, Any, Callable, Tuple, Union, Iterator

from src.longcontext.chunking import TextChunk, TextChunker, ChunkingStrategy
from src.longcontext.indexing import ChunkIndex, IndexType
from src.longcontext.retrieval import ChunkRetriever, RetrievalResult
from src.longcontext.summarizer import Summarizer, SummaryOptions, Summary

logger = logging.getLogger(__name__)

class LongContextManager:
    """Manager for handling long context text processing."""
    
    def __init__(
        self,
        model_provider: Callable[[str], str],
        embedding_provider: Optional[Callable[[str], List[float]]] = None,
        storage_path: Optional[str] = None,
        config: Dict[str, Any] = None
    ):
        """Initialize the long context manager.
        
        Args:
            model_provider: Function to generate text from the model
            embedding_provider: Function to generate embeddings
            storage_path: Path for storing indices and other data
            config: Additional configuration options
        """
        self.model_provider = model_provider
        self.embedding_provider = embedding_provider
        self.storage_path = storage_path
        self.config = config or {}
        
        # Initialize components
        self._initialize_components()
        
        # Internal state
        self.documents: Dict[str, Dict[str, Any]] = {}
        self.active_context: Dict[str, Any] = {
            "chunks": [],
            "latest_query": "",
            "summary": None,
            "metadata": {}
        }
        self.context_history: List[Dict[str, Any]] = []
        
        # Configuration
        self.max_context_window = self.config.get("max_context_window", 4096)
        self.max_context_chunks = self.config.get("max_context_chunks", 20)
        self.auto_summarize = self.config.get("auto_summarize", True)
        self.auto_augment = self.config.get("auto_augment", True)
        
        # Load existing data if storage path is provided
        if storage_path and os.path.exists(os.path.join(storage_path, "documents.json")):
            self.load()
    
    def _initialize_components(self) -> None:
        """Initialize the chunker, index, retriever, and summarizer."""
        # Initialize chunker
        chunker_config = self.config.get("chunker", {})
        self.chunker = TextChunker(
            strategy=ChunkingStrategy(chunker_config.get("strategy", "hybrid")),
            chunk_size=chunker_config.get("chunk_size", 1000),
            chunk_overlap=chunker_config.get("chunk_overlap", 200),
            embedding_provider=self.embedding_provider,
            config=chunker_config
        )
        
        # Initialize document index
        index_config = self.config.get("index", {})
        self.index = ChunkIndex(
            name="document_index",
            dimension=index_config.get("dimension", 1536),
            index_type=IndexType(index_config.get("index_type", "memory")),
            storage_path=self.storage_path,
            embedding_provider=self.embedding_provider,
            config=index_config
        )
        
        # Initialize retriever
        retriever_config = self.config.get("retriever", {})
        self.retriever = ChunkRetriever(
            index=self.index,
            embedding_provider=self.embedding_provider,
            config=retriever_config
        )
        
        # Initialize summarizer
        summarizer_config = self.config.get("summarizer", {})
        self.summarizer = Summarizer(
            model_provider=self.model_provider,
            config=summarizer_config
        )
    
    def add_document(
        self, 
        document_id: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        chunk: bool = True
    ) -> List[int]:
        """Add a document to the index.
        
        Args:
            document_id: ID for the document
            content: Document content
            metadata: Additional metadata
            chunk: Whether to chunk the document
            
        Returns:
            List of chunk IDs
        """
        logger.info(f"Adding document: {document_id}")
        
        # Store document metadata
        self.documents[document_id] = {
            "id": document_id,
            "length": len(content),
            "timestamp": time.time(),
            "metadata": metadata or {}
        }
        
        # Chunk the document if requested
        if chunk:
            chunk_metadata = {
                "document_id": document_id,
                "source": "document"
            }
            if metadata:
                chunk_metadata.update(metadata)
            
            chunks = self.chunker.chunk_text(content, chunk_metadata)
            
            # Add chunks to index
            chunk_ids = self.index.add(chunks, document_id)
            
            # Update document metadata
            self.documents[document_id]["chunk_count"] = len(chunks)
            self.documents[document_id]["chunk_ids"] = chunk_ids
            
            return chunk_ids
        
        # If not chunking, add the whole document as a single chunk
        chunk = TextChunk(
            text=content,
            metadata={
                "document_id": document_id,
                "source": "document",
                **(metadata or {})
            }
        )
        
        # Add embedding if provider available
        if self.embedding_provider:
            chunk = chunk.with_embedding(self.embedding_provider(content))
        
        # Add to index
        chunk_ids = self.index.add([chunk], document_id)
        
        # Update document metadata
        self.documents[document_id]["chunk_count"] = 1
        self.documents[document_id]["chunk_ids"] = chunk_ids
        
        return chunk_ids
    
    def retrieve_context(
        self,
        query: str,
        k: int = None,
        document_id: Optional[str] = None,
        strategy: str = "hybrid",
        update_active_context: bool = True
    ) -> RetrievalResult:
        """Retrieve relevant context for a query.
        
        Args:
            query: Query text
            k: Number of chunks to retrieve
            document_id: Optional document ID to restrict search to
            strategy: Retrieval strategy ('vector', 'keyword', 'hybrid')
            update_active_context: Whether to update the active context
            
        Returns:
            Retrieval result
        """
        logger.info(f"Retrieving context for query: {query}")
        
        # Retrieve relevant chunks
        if strategy == "vector":
            result = self.retriever.retrieve(query, k, document_id)
        elif strategy == "keyword":
            # Use keyword search fallback
            if not hasattr(self.retriever, "_keyword_search"):
                logger.warning("Keyword search not available, falling back to hybrid")
                result = self.retriever.retrieve_hybrid(query, k, document_id)
            else:
                keyword_results = self.retriever._keyword_search(query, k or 5, document_id)
                chunks = [chunk for _, _, chunk in keyword_results]
                scores = {chunk.index: score for _, score, chunk in keyword_results}
                result = RetrievalResult(chunks=chunks, scores=scores, query=query)
        else:  # hybrid
            result = self.retriever.retrieve_hybrid(query, k, document_id)
        
        # Update active context if requested
        if update_active_context:
            if len(self.active_context["chunks"]) > 0:
                # Archive the current context
                self.context_history.append(self.active_context.copy())
                
                # Keep the history limited to avoid memory issues
                max_history = self.config.get("max_context_history", 10)
                if len(self.context_history) > max_history:
                    self.context_history = self.context_history[-max_history:]
            
            # Set new active context
            self.active_context = {
                "chunks": result.chunks,
                "latest_query": query,
                "summary": None,
                "metadata": {
                    "timestamp": time.time(),
                    "strategy": strategy,
                    "query": query
                }
            }
            
            # Auto-generate summary if configured
            if self.auto_summarize and len(result.chunks) > 1:
                summary_options = SummaryOptions(
                    max_length=min(500, self.max_context_window // 4),
                    style="concise",
                    focus=query
                )
                
                self.active_context["summary"] = self.summarizer.summarize_chunks(result.chunks, summary_options)
        
        return result
    
    def get_active_context_text(
        self,
        include_summary: bool = None,
        max_tokens: Optional[int] = None,
        separator: str = "\n\n",
        chunk_prefix: str = "Context: "
    ) -> str:
        """Get the text of the active context.
        
        Args:
            include_summary: Whether to include the summary (defaults to auto_summarize)
            max_tokens: Maximum tokens to include (defaults to max_context_window)
            separator: Separator between chunks
            chunk_prefix: Prefix for each chunk
            
        Returns:
            Combined context text
        """
        if not self.active_context["chunks"]:
            return ""
        
        # Use defaults if not specified
        if include_summary is None:
            include_summary = self.auto_summarize
        if max_tokens is None:
            max_tokens = self.max_context_window
        
        # If a summary is available and requested, include it at the beginning
        if include_summary and self.active_context["summary"]:
            summary_text = f"Summary: {self.active_context['summary'].text}"
            
            # If the summary is short enough, include it with chunks
            if self.active_context["summary"].summary_length < max_tokens // 4:
                result = summary_text + separator
                
                # Limit the remaining chunks to fit
                remaining_tokens = max_tokens - (self.active_context["summary"].summary_length // 4)
                chunks_text = self._format_chunks_text(remaining_tokens, separator, chunk_prefix)
                
                return result + chunks_text
            else:
                # If the summary is too long, just return it
                return summary_text
        
        # If no summary or not using it, just return the chunks
        return self._format_chunks_text(max_tokens, separator, chunk_prefix)
    
    def _format_chunks_text(
        self,
        max_tokens: int,
        separator: str,
        chunk_prefix: str
    ) -> str:
        """Format the chunks into text with a token limit.
        
        Args:
            max_tokens: Maximum tokens to include
            separator: Separator between chunks
            chunk_prefix: Prefix for each chunk
            
        Returns:
            Formatted chunks text
        """
        # Create a retrieval result from active context chunks
        scores = {chunk.index: 1.0 for chunk in self.active_context["chunks"]}
        result = RetrievalResult(
            chunks=self.active_context["chunks"],
            scores=scores,
            query=self.active_context["latest_query"]
        )
        
        # Limit tokens
        limited_result = result.limit_tokens(max_tokens)
        
        # Format with prefix
        if chunk_prefix:
            texts = [f"{chunk_prefix}{chunk.text}" for chunk in limited_result.chunks]
        else:
            texts = [chunk.text for chunk in limited_result.chunks]
        
        return separator.join(texts)
    
    def augment_prompt(
        self,
        prompt: str,
        query: Optional[str] = None,
        k: int = None,
        document_id: Optional[str] = None,
        strategy: str = "hybrid",
        context_position: str = "prepend"
    ) -> str:
        """Augment a prompt with relevant context.
        
        Args:
            prompt: Original prompt
            query: Query for context retrieval (defaults to prompt)
            k: Number of chunks to retrieve
            document_id: Optional document ID to restrict search to
            strategy: Retrieval strategy
            context_position: Where to add context ("prepend", "append")
            
        Returns:
            Augmented prompt
        """
        # Use prompt as query if not specified
        if query is None:
            query = prompt
        
        # Retrieve relevant context
        result = self.retrieve_context(query, k, document_id, strategy)
        
        # If no context found, return original prompt
        if not result.chunks:
            return prompt
        
        # Get context text with summary if available
        context_text = self.get_active_context_text()
        
        # Augment prompt
        if context_position == "prepend":
            return f"{context_text}\n\n{prompt}"
        else:  # append
            return f"{prompt}\n\n{context_text}"
    
    def summarize_document(
        self,
        document_id: str,
        max_length: int = 500,
        style: str = "concise",
        focus: Optional[str] = None
    ) -> Summary:
        """Generate a summary of a document.
        
        Args:
            document_id: Document ID
            max_length: Maximum length of the summary
            style: Summary style
            focus: Optional focus area
            
        Returns:
            Document summary
        """
        # Get document chunks
        chunks = self.index.get_by_document(document_id)
        
        if not chunks:
            logger.warning(f"No chunks found for document: {document_id}")
            return Summary(
                text=f"Document {document_id} not found or empty.",
                original_length=0,
                summary_length=0,
                compression_ratio=0.0
            )
        
        # Create summary options
        options = SummaryOptions(
            max_length=max_length,
            style=style,
            focus=focus
        )
        
        # Generate summary
        return self.summarizer.summarize_chunks(chunks, options)
    
    def expand_query(self, query: str, num_variations: int = 3) -> List[str]:
        """Expand a query into multiple variations for improved retrieval.
        
        This is a simple implementation using the model to generate variations.
        
        Args:
            query: Original query
            num_variations: Number of variations to generate
            
        Returns:
            List of query variations
        """
        if not query:
            return []
        
        # Simple prompt for query expansion
        prompt = f"""Original query: "{query}"

Please generate {num_variations} alternative ways to express this query for a search system. 
Each variation should maintain the same meaning but use different phrasing, 
synonyms, or structure.

Variations:"""
        
        # Generate variations
        response = self.model_provider(prompt)
        
        # Parse the response
        variations = []
        
        # Extract numbered/bulleted points
        for line in response.split("\n"):
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
            
            # Look for numbered or bulleted points
            if re.match(r'^[\d\-\*\•]+\.?\s+', line):
                # Remove the prefix and add to variations
                query_var = re.sub(r'^[\d\-\*\•]+\.?\s+', '', line)
                
                # Remove quotes if present
                query_var = query_var.strip('"\'')
                
                if query_var and query_var.lower() != query.lower():
                    variations.append(query_var)
        
        # If we couldn't parse any variations, just return the original
        if not variations:
            return [query]
        
        # Add the original query at the beginning
        variations = [query] + variations
        
        # Limit to requested number
        return variations[:num_variations]
    
    def handle_long_query(
        self,
        query: str,
        max_query_length: int = 200,
        summarize: bool = True
    ) -> str:
        """Handle a long query by summarizing or truncating it.
        
        Args:
            query: Original query
            max_query_length: Maximum query length
            summarize: Whether to summarize long queries
            
        Returns:
            Processed query
        """
        if len(query) <= max_query_length:
            return query
        
        if summarize:
            # Summarize the query
            options = SummaryOptions(
                max_length=max_query_length,
                style="concise"
            )
            
            summary = self.summarizer.summarize(query, options)
            return summary.text
        else:
            # Just truncate to max length at a word boundary
            for i in range(max_query_length, max_query_length - 50, -1):
                if i >= 0 and i < len(query) and query[i].isspace():
                    return query[:i].rstrip() + "..."
            
            # If no word boundary found, just truncate
            return query[:max_query_length] + "..."
    
    def save(self) -> None:
        """Save the long context manager data to disk."""
        if not self.storage_path:
            logger.warning("No storage path provided, cannot save")
            return
        
        os.makedirs(self.storage_path, exist_ok=True)
        
        # Save document metadata
        docs_path = os.path.join(self.storage_path, "documents.json")
        with open(docs_path, 'w') as f:
            json.dump(self.documents, f)
        
        # Save index
        self.index.save()
        
        logger.info(f"Saved context manager data to {self.storage_path}")
    
    def load(self) -> None:
        """Load the long context manager data from disk."""
        if not self.storage_path:
            logger.warning("No storage path provided, cannot load")
            return
        
        # Load document metadata
        docs_path = os.path.join(self.storage_path, "documents.json")
        if os.path.exists(docs_path):
            with open(docs_path, 'r') as f:
                self.documents = json.load(f)
        
        # Load index
        self.index.load()
        
        logger.info(f"Loaded context manager data from {self.storage_path}")
    
    def get_document_info(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a document.
        
        Args:
            document_id: Document ID
            
        Returns:
            Document information or None if not found
        """
        return self.documents.get(document_id) 