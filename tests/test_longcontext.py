"""
Integration tests for the Long-Context processing system.

This module tests the various components and functionality of the PersLM
long-context system, including chunking, retrieval, and summarization.
"""

import os
import unittest
import tempfile
import json
import time
from typing import List, Dict, Any, Optional, Callable

import numpy as np

from src.longcontext.manager import LongContextManager
from src.longcontext.chunking import TextChunker, ChunkingStrategy, TextChunk
from src.longcontext.indexing import ChunkIndex, IndexType
from src.longcontext.retrieval import ChunkRetriever
from src.longcontext.summarizer import Summarizer, SummaryOptions


class MockModelProvider:
    """Mock model provider for testing."""
    
    def __call__(self, prompt: str) -> str:
        """Generate mock response."""
        if "summarize" in prompt.lower():
            return "This is a summary of the provided content."
        
        if "?" in prompt:
            return f"Answer to: {prompt.split('?')[0]}?"
            
        return f"Response to: {prompt[:50]}..."


class MockEmbeddingProvider:
    """Mock embedding provider for testing."""
    
    def __init__(self, dim: int = 384):
        """Initialize with embedding dimension."""
        self.dim = dim
        self.cache = {}
    
    def __call__(self, text: str) -> List[float]:
        """Generate mock embedding."""
        if text in self.cache:
            return self.cache[text]
            
        # Use hash of text to create deterministic embeddings
        text_hash = hash(text) % 10000
        np.random.seed(text_hash)
        embedding = list(np.random.randn(self.dim).astype(float))
        
        # Cache result
        self.cache[text] = embedding
        return embedding


class TestLongContext(unittest.TestCase):
    """Test the long-context system."""
    
    def setUp(self):
        """Set up test environment."""
        # Create mock providers
        self.model_provider = MockModelProvider()
        self.embedding_provider = MockEmbeddingProvider()
        
        # Create temp directory for storage
        self.temp_dir = tempfile.mkdtemp()
        
        # Create manager
        self.manager = LongContextManager(
            model_provider=self.model_provider,
            embedding_provider=self.embedding_provider,
            storage_path=self.temp_dir,
            config={
                "max_context_window": 4096,
                "max_context_chunks": 20,
                "auto_summarize": True,
                "auto_augment": True
            }
        )
        
        # Create test document
        self.test_document = "\n\n".join([
            f"Paragraph {i}: " + " ".join([f"word{j}" for j in range(100)])
            for i in range(20)
        ])
        
        # Add document
        self.doc_id = "test_doc_001"
        self.chunk_ids = self.manager.add_document(
            document_id=self.doc_id,
            content=self.test_document,
            metadata={"title": "Test Document"}
        )
    
    def tearDown(self):
        """Clean up after tests."""
        # Remove temp directory
        for root, dirs, files in os.walk(self.temp_dir, topdown=False):
            for file in files:
                os.remove(os.path.join(root, file))
            for dir in dirs:
                os.rmdir(os.path.join(root, dir))
        os.rmdir(self.temp_dir)
    
    def test_document_chunking(self):
        """Test document chunking."""
        # Check chunks were created
        self.assertGreater(len(self.chunk_ids), 0)
        
        # Get document info
        doc_info = self.manager.get_document_info(self.doc_id)
        self.assertIsNotNone(doc_info)
        self.assertEqual(doc_info["id"], self.doc_id)
        self.assertEqual(doc_info["chunk_count"], len(self.chunk_ids))
    
    def test_retrieval(self):
        """Test context retrieval."""
        # Retrieve with vector search
        query = "Paragraph 5"
        result = self.manager.retrieve_context(
            query=query,
            k=3,
            document_id=self.doc_id,
            strategy="vector"
        )
        
        # Check results
        self.assertGreater(result.count, 0)
        self.assertIn("Paragraph 5", result.get_text())
        
        # Test retrieval with keyword search
        result2 = self.manager.retrieve_context(
            query=query,
            k=3,
            document_id=self.doc_id,
            strategy="keyword"
        )
        
        # Check results
        self.assertGreater(result2.count, 0)
        self.assertIn("Paragraph 5", result2.get_text())
        
        # Test hybrid retrieval
        result3 = self.manager.retrieve_context(
            query=query,
            k=3,
            document_id=self.doc_id,
            strategy="hybrid"
        )
        
        # Check results
        self.assertGreater(result3.count, 0)
        self.assertIn("Paragraph 5", result3.get_text())
    
    def test_prompt_augmentation(self):
        """Test prompt augmentation."""
        # Create a prompt
        prompt = "What is discussed in paragraph 10?"
        
        # Augment prompt
        augmented_prompt = self.manager.augment_prompt(
            prompt=prompt,
            query="paragraph 10",
            k=2,
            document_id=self.doc_id,
            strategy="hybrid",
            context_position="prepend"
        )
        
        # Check prompt
        self.assertGreater(len(augmented_prompt), len(prompt))
        self.assertIn("Paragraph 10", augmented_prompt)
        self.assertIn(prompt, augmented_prompt)
        
        # Test with different position
        augmented_prompt2 = self.manager.augment_prompt(
            prompt=prompt,
            query="paragraph 10",
            context_position="append"
        )
        
        # Check prompt
        self.assertGreater(len(augmented_prompt2), len(prompt))
        self.assertIn(prompt, augmented_prompt2)
    
    def test_summarization(self):
        """Test document summarization."""
        # Summarize document
        summary = self.manager.summarize_document(
            document_id=self.doc_id,
            max_length=200,
            style="concise"
        )
        
        # Check summary
        self.assertIsNotNone(summary)
        self.assertGreater(len(summary.text), 0)
        
        # Test with focus
        summary2 = self.manager.summarize_document(
            document_id=self.doc_id,
            focus="paragraph 15"
        )
        
        # Check summary
        self.assertIsNotNone(summary2)
        self.assertGreater(len(summary2.text), 0)
    
    def test_query_expansion(self):
        """Test query expansion."""
        # Expand query
        query = "Information about paragraph 7"
        expanded_queries = self.manager.expand_query(
            query=query,
            num_variations=3
        )
        
        # Check expanded queries
        self.assertEqual(len(expanded_queries), 3)
        self.assertIn(query, expanded_queries)
    
    def test_long_query_handling(self):
        """Test handling of long queries."""
        # Create a long query
        long_query = " ".join(["query_word"] * 1000)
        
        # Handle long query
        handled_query = self.manager.handle_long_query(
            query=long_query,
            max_query_length=100,
            summarize=True
        )
        
        # Check result
        self.assertLess(len(handled_query), len(long_query))
        self.assertLessEqual(len(handled_query), 100)
    
    def test_active_context(self):
        """Test active context management."""
        # Retrieve context to set active context
        query = "Paragraph 3"
        self.manager.retrieve_context(
            query=query,
            update_active_context=True
        )
        
        # Get active context text
        context_text = self.manager.get_active_context_text(
            include_summary=True
        )
        
        # Check context
        self.assertGreater(len(context_text), 0)
        
        # Retrieve different context
        query2 = "Paragraph 18"
        self.manager.retrieve_context(
            query=query2,
            update_active_context=True
        )
        
        # Check that context history was updated
        self.assertEqual(len(self.manager.context_history), 1)
        self.assertEqual(self.manager.context_history[0]["latest_query"], query)


class TestChunker(unittest.TestCase):
    """Test the text chunking functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.embedding_provider = MockEmbeddingProvider()
        
        # Test text
        self.test_text = "\n\n".join([
            f"Paragraph {i}: " + " ".join([f"word{j}" for j in range(50)])
            for i in range(10)
        ])
    
    def test_fixed_size_chunking(self):
        """Test fixed size chunking."""
        chunker = TextChunker(
            strategy=ChunkingStrategy.FIXED_SIZE,
            chunk_size=500,
            chunk_overlap=100,
            embedding_provider=self.embedding_provider
        )
        
        chunks = chunker.chunk_text(self.test_text)
        
        # Check chunks
        self.assertGreater(len(chunks), 1)
        for chunk in chunks:
            self.assertLessEqual(chunk.size, 500 + 100)  # Allow some flexibility
            self.assertIsNotNone(chunk.embedding)
    
    def test_paragraph_chunking(self):
        """Test paragraph-based chunking."""
        chunker = TextChunker(
            strategy=ChunkingStrategy.PARAGRAPH,
            chunk_size=1000,
            chunk_overlap=0,
            embedding_provider=self.embedding_provider
        )
        
        chunks = chunker.chunk_text(self.test_text)
        
        # Check chunks
        self.assertGreaterEqual(len(chunks), 1)
        
        # Each chunk should contain complete paragraphs
        for chunk in chunks:
            paragraphs = chunk.text.split("\n\n")
            for p in paragraphs:
                if p.strip():
                    self.assertIn("Paragraph", p)
    
    def test_hybrid_chunking(self):
        """Test hybrid chunking strategy."""
        chunker = TextChunker(
            strategy=ChunkingStrategy.HYBRID,
            chunk_size=800,
            chunk_overlap=150,
            embedding_provider=self.embedding_provider
        )
        
        chunks = chunker.chunk_text(self.test_text)
        
        # Check chunks
        self.assertGreater(len(chunks), 1)
        
        # Verify chunk properties
        for i, chunk in enumerate(chunks):
            self.assertEqual(chunk.index, i)
            self.assertIn("chunk_index", chunk.metadata)
            self.assertEqual(chunk.metadata["chunk_index"], i)
            self.assertIn("chunk_count", chunk.metadata)
            self.assertEqual(chunk.metadata["chunk_count"], len(chunks))


if __name__ == "__main__":
    unittest.main() 