# Long-Context Support System

This document describes the long-context processing system in PersLM, which enables handling documents and conversations that exceed the model's context window limitations.

## Overview

The long-context system addresses the fixed context window limitation of large language models through:

1. **Chunking**: Breaking long text into manageable, semantically meaningful pieces
2. **Indexing**: Creating searchable representations of text chunks
3. **Retrieval**: Finding the most relevant chunks for a given query
4. **Context Assembly**: Combining retrieved chunks into a coherent context
5. **Summarization**: Condensing information to fit within context constraints

This retrieval-augmented generation (RAG) approach allows PersLM to effectively work with:
- Long documents (articles, papers, books)
- Extended conversations with history
- Code repositories and documentation
- Multi-part structured content

## Architecture

### Core Components

1. **LongContextManager**: Central orchestrator for long-context processing
2. **TextChunker**: Converts long texts into manageable chunks
3. **ChunkIndex**: Stores and indexes text chunks for retrieval
4. **ChunkRetriever**: Finds relevant chunks based on queries
5. **Summarizer**: Creates concise summaries of content

### Data Structures

1. **TextChunk**: A piece of text with metadata and optional embedding
   ```python
   @dataclass
   class TextChunk:
       text: str
       index: int = 0
       metadata: Dict[str, Any] = field(default_factory=dict)
       embedding: Optional[List[float]] = None
   ```

2. **RetrievalResult**: Result of a retrieval operation
   ```python
   @dataclass
   class RetrievalResult:
       chunks: List[TextChunk] = field(default_factory=list)
       scores: Dict[int, float] = field(default_factory=dict)
       query: str = ""
       metadata: Dict[str, Any] = field(default_factory=dict)
   ```

3. **Summary**: Result of a summarization operation
   ```python
   @dataclass
   class Summary:
       text: str
       source_chunks: List[TextChunk]
       metadata: Dict[str, Any] = field(default_factory=dict)
   ```

## Chunking Strategies

The system supports multiple chunking strategies:

1. **Fixed Size**: Chunks of consistent character/token count
2. **Paragraph**: Chunks based on paragraph boundaries
3. **Sentence**: Chunks based on sentence boundaries
4. **Semantic**: Chunks based on topic or semantic shifts
5. **Hybrid**: Combination of strategies (default)

Configuration options include:
- `chunk_size`: Target size of chunks (default: 1000 characters)
- `chunk_overlap`: Overlap between chunks (default: 200 characters)
- `respect_paragraphs`: Whether to avoid breaking paragraphs
- `respect_sentences`: Whether to avoid breaking sentences

## Indexing and Retrieval

### Index Types

1. **Memory**: In-memory index (default)
2. **FAISS**: FAISS vector index for large-scale retrieval
3. **Hybrid**: Combined index types

### Retrieval Methods

1. **Vector Retrieval**: Finding chunks by embedding similarity
2. **Keyword Retrieval**: Finding chunks by keyword matching
3. **Hybrid Retrieval**: Combining vector and keyword approaches

Parameters:
- `k`: Number of chunks to retrieve
- `min_score`: Minimum relevance score threshold
- `strategy`: Retrieval strategy (vector, keyword, hybrid)

## Context Assembly

The system assembles context from retrieved chunks using various strategies:

1. **Prepend**: Adding context before the query
2. **Interleave**: Alternating between context and query parts
3. **Summary First**: Leading with a summary of context
4. **Token Aware**: Constructing context based on token limits

## Integration with Training and Inference

### Training Integration

The long-context system enhances model training by:
1. Providing extended context from similar examples
2. Generating additional in-context examples
3. Supporting training on long-document tasks

### Inference Integration

During inference, the system:
1. Retrieves relevant context based on the query
2. Injects retrieved context into the prompt
3. May generate multiple responses with different context subsets
4. Filters and refines generated responses

## Usage Examples

### Adding Documents

```python
from src.longcontext.manager import LongContextManager

# Initialize the manager
manager = LongContextManager(
    model_provider=model_provider,
    embedding_provider=embedding_provider
)

# Add a document
document_id = "doc_123"
with open("long_document.txt", "r") as f:
    content = f.read()
    
chunk_ids = manager.add_document(
    document_id=document_id,
    content=content,
    metadata={"title": "Long Document", "author": "Example Author"}
)

print(f"Added document with {len(chunk_ids)} chunks")
```

### Retrieving Context

```python
# Retrieve context for a query
query = "What are the main findings of the study?"
result = manager.retrieve_context(
    query=query,
    k=5,  # Number of chunks to retrieve
    document_id="doc_123",  # Optional: restrict to specific document
    strategy="hybrid"  # Use hybrid retrieval
)

# Get the combined text of retrieved chunks
context_text = result.get_text(separator="\n\n")
print(f"Retrieved {result.count} chunks with {result.total_tokens} tokens")
```

### Augmenting Prompts

```python
# Create a prompt with injected context
prompt = "Summarize the key findings from the document."
augmented_prompt = manager.augment_prompt(
    prompt=prompt,
    query="key findings",
    context_position="prepend"
)

# Generate response using augmented prompt
response = model_provider(augmented_prompt)
```

### Summarizing Long Content

```python
# Summarize a document
summary = manager.summarize_document(
    document_id="doc_123",
    max_length=500,
    style="concise",
    focus="methodology and results"
)

print(summary.text)
```

## Advanced Features

### Query Expansion

The system can expand queries to improve retrieval:

```python
expanded_queries = manager.expand_query(
    query="climate change impacts",
    num_variations=3
)
# Result might include: "effects of global warming", 
# "climate change consequences", "environmental impacts of climate change"
```

### Dynamic Context Management

For interactive sessions, the system maintains:
- Active context: Currently relevant chunks
- Context history: Previously used contexts
- Dynamic updating: Adding and removing chunks based on relevance

### Cross-Document Retrieval

The system supports retrieving context across multiple documents:

```python
result = manager.retrieve_context(
    query="Compare the approaches to renewable energy",
    document_id=None,  # Retrieve from all documents
    k=10
)
```

## Performance Considerations

1. **Embedding Caching**: Embeddings are cached to avoid recomputation
2. **Batch Processing**: Operations are batched where possible
3. **Progressive Loading**: Documents are loaded and processed progressively
4. **Index Optimization**: Indexes are optimized for specific retrieval patterns

## Extension Guidelines

### Custom Chunking Strategy

```python
from src.longcontext.chunking import TextChunker, ChunkingStrategy

# Create custom chunker
custom_chunker = TextChunker(
    strategy=ChunkingStrategy.HYBRID,
    chunk_size=500,
    chunk_overlap=100,
    config={"respect_paragraphs": True, "respect_sentences": True}
)
```

### Custom Retrieval Method

```python
from src.longcontext.retrieval import ChunkRetriever

# Create custom retriever
custom_retriever = ChunkRetriever(
    index=chunk_index,
    embedding_provider=embedding_provider,
    config={"use_reranker": True, "default_top_k": 10}
)
```

## Future Enhancements

1. **Hierarchical Chunking**: Multi-level chunking for better organization
2. **Cross-Referenced Retrieval**: Handling cross-references between documents
3. **Adaptive Context Window**: Dynamically adjusting context size based on complexity
4. **Streaming Context**: Progressive context loading for real-time applications
5. **Multi-Modal Context**: Supporting non-text content in context 