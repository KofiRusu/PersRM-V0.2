"""
Text Chunking Module

This module implements text chunking strategies for splitting long documents into
smaller, semantically coherent pieces for processing by language models.
"""

import re
from enum import Enum
from typing import List, Dict, Optional, Any, Callable, Tuple
from dataclasses import dataclass, field

@dataclass
class TextChunk:
    """A chunk of text extracted from a document."""
    text: str
    index: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None
    
    @property
    def size(self) -> int:
        """Get the size of the chunk in characters."""
        return len(self.text)
    
    @property
    def estimated_tokens(self) -> int:
        """Estimate the number of tokens in the chunk.
        
        This is a simple heuristic - actual token count depends on the tokenizer.
        Roughly estimates 4 characters per token as a rule of thumb.
        """
        return max(1, len(self.text) // 4)
    
    def with_embedding(self, embedding: List[float]) -> 'TextChunk':
        """Return a new chunk with the specified embedding."""
        return TextChunk(
            text=self.text,
            index=self.index,
            metadata=self.metadata.copy(),
            embedding=embedding
        )


class ChunkingStrategy(Enum):
    """Strategies for chunking text."""
    FIXED_SIZE = "fixed_size"  # Chunk by character/token count
    PARAGRAPH = "paragraph"    # Chunk by paragraphs
    SENTENCE = "sentence"      # Chunk by sentences
    SEMANTIC = "semantic"      # Chunk by semantic boundaries
    HYBRID = "hybrid"          # Combination of strategies


class TextChunker:
    """Class for chunking text into smaller pieces."""
    
    def __init__(
        self,
        strategy: ChunkingStrategy = ChunkingStrategy.HYBRID,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        embedding_provider: Optional[Callable[[str], List[float]]] = None,
        config: Dict[str, Any] = None
    ):
        """Initialize the text chunker.
        
        Args:
            strategy: Strategy for chunking
            chunk_size: Target size of chunks in characters
            chunk_overlap: Overlap between chunks in characters
            embedding_provider: Function to generate embeddings for chunks
            config: Additional configuration options
        """
        self.strategy = strategy
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.embedding_provider = embedding_provider
        self.config = config or {}
        
        # Additional configuration
        self.respect_paragraphs = self.config.get("respect_paragraphs", True)
        self.respect_sentences = self.config.get("respect_sentences", True)
        self.min_chunk_size = self.config.get("min_chunk_size", 100)
        self.max_chunk_size = self.config.get("max_chunk_size", 2000)
    
    def chunk_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """Chunk text using the selected strategy.
        
        Args:
            text: Text to chunk
            metadata: Metadata to attach to chunks
            
        Returns:
            List of text chunks
        """
        if not text:
            return []
        
        # Select chunking method based on strategy
        if self.strategy == ChunkingStrategy.FIXED_SIZE:
            chunks = self._chunk_fixed_size(text)
        elif self.strategy == ChunkingStrategy.PARAGRAPH:
            chunks = self._chunk_by_paragraph(text)
        elif self.strategy == ChunkingStrategy.SENTENCE:
            chunks = self._chunk_by_sentence(text)
        elif self.strategy == ChunkingStrategy.SEMANTIC:
            chunks = self._chunk_semantic(text)
        else:  # HYBRID
            chunks = self._chunk_hybrid(text)
        
        # Add metadata
        for i, chunk in enumerate(chunks):
            chunk.index = i
            if metadata:
                chunk.metadata.update(metadata)
            chunk.metadata["chunk_index"] = i
            chunk.metadata["chunk_count"] = len(chunks)
        
        # Add embeddings if provider available
        if self.embedding_provider:
            for chunk in chunks:
                chunk.embedding = self.embedding_provider(chunk.text)
        
        return chunks
    
    def _chunk_fixed_size(self, text: str) -> List[TextChunk]:
        """Chunk text into fixed-size chunks.
        
        Args:
            text: Text to chunk
            
        Returns:
            List of text chunks
        """
        chunks = []
        start = 0
        text_length = len(text)
        
        while start < text_length:
            # Calculate end position
            end = start + self.chunk_size
            
            # Adjust end if we need to respect paragraph or sentence boundaries
            if self.respect_paragraphs and start > 0:
                # Find the next paragraph break if within reasonable distance
                next_break = text.find("\n\n", start, min(end + 200, text_length))
                if next_break != -1:
                    end = next_break
            elif self.respect_sentences and start > 0:
                # Find the next sentence break if within reasonable distance
                next_break = self._find_sentence_end(text, start, min(end + 100, text_length))
                if next_break != -1:
                    end = next_break
            
            # Ensure we don't exceed text length
            end = min(end, text_length)
            
            # Create chunk
            chunk_text = text[start:end].strip()
            if chunk_text:  # Only add non-empty chunks
                chunks.append(TextChunk(text=chunk_text))
            
            # Move start position for next chunk
            start = end - self.chunk_overlap if end < text_length else text_length
            
            # Ensure forward progress
            if start <= 0:
                start = end
        
        return chunks
    
    def _chunk_by_paragraph(self, text: str) -> List[TextChunk]:
        """Chunk text by paragraphs.
        
        Args:
            text: Text to chunk
            
        Returns:
            List of text chunks
        """
        chunks = []
        current_chunk = ""
        
        # Split text into paragraphs
        paragraphs = re.split(r'\n\s*\n', text)
        
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            
            # Check if adding this paragraph would exceed the max chunk size
            if len(current_chunk) + len(paragraph) > self.max_chunk_size and current_chunk:
                # Save current chunk and start a new one
                chunks.append(TextChunk(text=current_chunk))
                current_chunk = paragraph
            else:
                # Add to current chunk
                if current_chunk:
                    current_chunk += "\n\n" + paragraph
                else:
                    current_chunk = paragraph
        
        # Add the last chunk if not empty
        if current_chunk:
            chunks.append(TextChunk(text=current_chunk))
        
        # Handle chunks that are too large
        result = []
        for chunk in chunks:
            if chunk.size > self.max_chunk_size:
                # Recursively chunk oversized chunks using fixed size strategy
                result.extend(self._chunk_fixed_size(chunk.text))
            else:
                result.append(chunk)
        
        # Combine chunks that are too small
        if self.config.get("combine_small_chunks", True):
            result = self._combine_small_chunks(result)
        
        return result
    
    def _chunk_by_sentence(self, text: str) -> List[TextChunk]:
        """Chunk text by sentences, keeping sentences together.
        
        Args:
            text: Text to chunk
            
        Returns:
            List of text chunks
        """
        chunks = []
        current_chunk = ""
        
        # Split text into sentences
        sentences = self._split_into_sentences(text)
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # Check if adding this sentence would exceed the max chunk size
            if len(current_chunk) + len(sentence) > self.max_chunk_size and current_chunk:
                # Save current chunk and start a new one
                chunks.append(TextChunk(text=current_chunk))
                current_chunk = sentence
            else:
                # Add to current chunk
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence
        
        # Add the last chunk if not empty
        if current_chunk:
            chunks.append(TextChunk(text=current_chunk))
        
        # Combine chunks that are too small
        if self.config.get("combine_small_chunks", True):
            chunks = self._combine_small_chunks(chunks)
        
        return chunks
    
    def _chunk_semantic(self, text: str) -> List[TextChunk]:
        """Chunk text based on semantic boundaries.
        
        This is a placeholder implementation. In a real implementation,
        this would use a semantic segmentation model to find natural boundaries.
        
        Args:
            text: Text to chunk
            
        Returns:
            List of text chunks
        """
        # If no embedding provider, fall back to hybrid chunking
        if not self.embedding_provider:
            return self._chunk_hybrid(text)
        
        # For now, use a simplified approach based on paragraph boundaries
        chunks = self._chunk_by_paragraph(text)
        
        # In a real implementation, we would refine these chunks based on
        # semantic similarity between adjacent paragraphs
        
        return chunks
    
    def _chunk_hybrid(self, text: str) -> List[TextChunk]:
        """Hybrid chunking strategy combining multiple approaches.
        
        Args:
            text: Text to chunk
            
        Returns:
            List of text chunks
        """
        # Split into paragraphs first
        paragraphs = re.split(r'\n\s*\n', text)
        
        chunks = []
        current_chunk = ""
        
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            
            # If paragraph is very long, split it by sentences
            if len(paragraph) > self.chunk_size:
                # If current chunk is not empty, add it to chunks
                if current_chunk:
                    chunks.append(TextChunk(text=current_chunk))
                    current_chunk = ""
                
                # Split the long paragraph by sentences
                sentences = self._split_into_sentences(paragraph)
                
                chunk_sentences = []
                for sentence in sentences:
                    # If adding this sentence would exceed max size and we have sentences,
                    # create a new chunk
                    if chunk_sentences and len(" ".join(chunk_sentences)) + len(sentence) > self.max_chunk_size:
                        chunks.append(TextChunk(text=" ".join(chunk_sentences)))
                        chunk_sentences = [sentence]
                    else:
                        chunk_sentences.append(sentence)
                
                # Add the remaining sentences as a chunk
                if chunk_sentences:
                    chunks.append(TextChunk(text=" ".join(chunk_sentences)))
            
            # For normal paragraphs, add to the current chunk
            elif len(current_chunk) + len(paragraph) > self.max_chunk_size and current_chunk:
                # Current chunk is full, add it to chunks
                chunks.append(TextChunk(text=current_chunk))
                current_chunk = paragraph
            else:
                # Add to current chunk
                if current_chunk:
                    current_chunk += "\n\n" + paragraph
                else:
                    current_chunk = paragraph
        
        # Add the last chunk if not empty
        if current_chunk:
            chunks.append(TextChunk(text=current_chunk))
        
        # Combine chunks that are too small
        if self.config.get("combine_small_chunks", True):
            chunks = self._combine_small_chunks(chunks)
        
        return chunks
    
    def _combine_small_chunks(self, chunks: List[TextChunk]) -> List[TextChunk]:
        """Combine chunks that are smaller than min_chunk_size.
        
        Args:
            chunks: List of chunks to combine
            
        Returns:
            List of combined chunks
        """
        if not chunks:
            return []
        
        result = []
        current_chunk = chunks[0].text
        
        for i in range(1, len(chunks)):
            # If combining would exceed max size, add current chunk to result
            if len(current_chunk) + len(chunks[i].text) > self.max_chunk_size:
                result.append(TextChunk(text=current_chunk))
                current_chunk = chunks[i].text
            else:
                # Combine with a separator
                current_chunk += "\n\n" + chunks[i].text
        
        # Add the last chunk
        if current_chunk:
            result.append(TextChunk(text=current_chunk))
        
        return result
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences.
        
        Args:
            text: Text to split
            
        Returns:
            List of sentences
        """
        # Simple regex-based sentence splitter
        # Would be better to use a proper NLP library in production
        sentence_endings = r'(?<=[.!?])\s+'
        sentences = re.split(sentence_endings, text)
        
        # Remove empty sentences
        return [s.strip() for s in sentences if s.strip()]
    
    def _find_sentence_end(self, text: str, start: int, end: int) -> int:
        """Find the end of a sentence within a range.
        
        Args:
            text: Text to search
            start: Start position
            end: End position
            
        Returns:
            Position of the end of the sentence, or -1 if not found
        """
        # Look for sentence-ending punctuation followed by whitespace
        for i in range(end, start, -1):
            if i < len(text) and i > 0:
                if text[i-1] in ['.', '!', '?'] and (i == len(text) or text[i].isspace()):
                    return i
        
        return -1 