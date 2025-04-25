"""
Long Context Module for PersLM

This package implements long-context capabilities for handling documents and conversations
that exceed the model's context window size through chunking, retrieval, and summarization.

Key components:
- Chunking: Splitting long documents into manageable chunks
- Indexing: Creating and maintaining vector indices for retrieval
- Retrieval: Finding and retrieving relevant chunks
- Summarization: Creating condensed representations of content
- Context Management: Dynamically managing the active context window
"""

from src.longcontext.chunking import TextChunker, ChunkingStrategy
from src.longcontext.indexing import ChunkIndex
from src.longcontext.retrieval import ChunkRetriever
from src.longcontext.summarizer import Summarizer
from src.longcontext.manager import LongContextManager 