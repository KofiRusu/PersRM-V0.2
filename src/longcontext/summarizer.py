"""
Text Summarization Module

This module implements text summarization capabilities for condensing long documents
into shorter representations.
"""

import re
import logging
from typing import List, Dict, Optional, Any, Callable, Union
from dataclasses import dataclass, field

from src.longcontext.chunking import TextChunk

logger = logging.getLogger(__name__)

@dataclass
class SummaryOptions:
    """Options for summary generation."""
    max_length: int = 200
    style: str = "concise"  # concise, detailed, bullet_points
    focus: Optional[str] = None  # Optional focus area or query
    compression_ratio: float = 0.2  # Target summary length as ratio of original
    preserve_keywords: List[str] = field(default_factory=list)
    include_metadata: bool = False

@dataclass
class Summary:
    """A summary of a text or document."""
    text: str
    original_length: int
    summary_length: int
    compression_ratio: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def reduction_percentage(self) -> float:
        """Get the percentage by which the text was reduced."""
        if self.original_length == 0:
            return 0.0
        return 100 * (1 - self.summary_length / self.original_length)


class Summarizer:
    """Text summarizer for condensing long documents."""
    
    def __init__(
        self,
        model_provider: Callable[[str], str],
        config: Dict[str, Any] = None
    ):
        """Initialize the summarizer.
        
        Args:
            model_provider: Function to generate text from the model
            config: Additional configuration options
        """
        self.model_provider = model_provider
        self.config = config or {}
        
        # Configuration options
        self.max_input_length = self.config.get("max_input_length", 4000)
        self.default_style = self.config.get("default_style", "concise")
        self.use_intermediate_summaries = self.config.get("use_intermediate_summaries", True)
        self.prompt_templates = self.config.get("prompt_templates", {
            "concise": "Summarize the following text concisely:",
            "detailed": "Provide a detailed summary of the following text, capturing the main points and key details:",
            "bullet_points": "Summarize the following text as a list of bullet points:"
        })
    
    def summarize(
        self, 
        text: str, 
        options: Optional[SummaryOptions] = None
    ) -> Summary:
        """Summarize a text.
        
        Args:
            text: Text to summarize
            options: Summary options
            
        Returns:
            Generated summary
        """
        if not text:
            return Summary(
                text="",
                original_length=0,
                summary_length=0,
                compression_ratio=0.0
            )
        
        # Use default options if not provided
        if options is None:
            options = SummaryOptions()
        
        # If text is short enough, return as is
        if len(text) <= options.max_length:
            return Summary(
                text=text,
                original_length=len(text),
                summary_length=len(text),
                compression_ratio=1.0
            )
        
        # If text is too long, we need to chunk it
        if len(text) > self.max_input_length and self.use_intermediate_summaries:
            return self._summarize_long_text(text, options)
        
        # Generate summary
        summary_text = self._generate_summary(text, options)
        
        # Calculate metrics
        return Summary(
            text=summary_text,
            original_length=len(text),
            summary_length=len(summary_text),
            compression_ratio=len(summary_text) / len(text),
            metadata={
                "style": options.style,
                "focus": options.focus,
                "target_compression_ratio": options.compression_ratio
            }
        )
    
    def _generate_summary(
        self,
        text: str,
        options: SummaryOptions
    ) -> str:
        """Generate a summary for a text using the model.
        
        Args:
            text: Text to summarize
            options: Summary options
            
        Returns:
            Generated summary
        """
        # Select prompt template based on style
        prompt_template = self.prompt_templates.get(options.style, self.prompt_templates[self.default_style])
        
        # Build prompt
        prompt = f"{prompt_template}\n\n{text}"
        
        # Add focus if provided
        if options.focus:
            prompt += f"\n\nFocus on aspects related to: {options.focus}"
        
        # Add length guidance
        prompt += f"\n\nProvide a summary of approximately {options.max_length} characters."
        
        # Add keywords to preserve if provided
        if options.preserve_keywords:
            keywords_str = ", ".join(options.preserve_keywords)
            prompt += f"\n\nMake sure to include these key terms in the summary: {keywords_str}"
        
        # Generate summary
        summary_text = self.model_provider(prompt)
        
        # Post-process summary
        summary_text = self._post_process_summary(summary_text, options.style)
        
        # Truncate if too long
        if len(summary_text) > options.max_length * 1.2:  # Allow some flexibility
            # Try to truncate at a sentence boundary
            truncation_point = self._find_sentence_boundary(summary_text, options.max_length)
            if truncation_point > 0:
                summary_text = summary_text[:truncation_point]
        
        return summary_text
    
    def _post_process_summary(self, summary: str, style: str) -> str:
        """Post-process generated summary.
        
        Args:
            summary: Raw summary from model
            style: Summary style
            
        Returns:
            Processed summary
        """
        # Remove any "Summary:" prefix commonly added by models
        summary = re.sub(r'^(Summary|Summary:)\s*', '', summary, flags=re.IGNORECASE)
        
        # Clean up whitespace
        summary = summary.strip()
        
        # Format according to style
        if style == "bullet_points" and not summary.startswith("- "):
            # If model didn't format as bullet points, convert paragraphs to bullet points
            paragraphs = [p.strip() for p in summary.split("\n") if p.strip()]
            summary = "\n".join([f"- {p}" if not p.startswith("- ") else p for p in paragraphs])
        
        return summary
    
    def _summarize_long_text(
        self,
        text: str,
        options: SummaryOptions
    ) -> Summary:
        """Summarize a long text using a divide-and-conquer approach.
        
        Args:
            text: Long text to summarize
            options: Summary options
            
        Returns:
            Generated summary
        """
        # Split the text into chunks
        chunks = self._split_into_chunks(text, self.max_input_length)
        
        # Generate intermediate summaries for each chunk
        intermediate_summaries = []
        for i, chunk in enumerate(chunks):
            chunk_options = SummaryOptions(
                max_length=int(self.max_input_length * options.compression_ratio),
                style=options.style,
                focus=options.focus,
                compression_ratio=options.compression_ratio,
                preserve_keywords=options.preserve_keywords
            )
            
            chunk_summary = self._generate_summary(chunk, chunk_options)
            intermediate_summaries.append(chunk_summary)
        
        # If we have multiple intermediate summaries, combine them
        if len(intermediate_summaries) > 1:
            combined_text = "\n\n".join(intermediate_summaries)
            
            # Generate final summary from intermediate summaries
            final_summary = self._generate_summary(combined_text, options)
            
            return Summary(
                text=final_summary,
                original_length=len(text),
                summary_length=len(final_summary),
                compression_ratio=len(final_summary) / len(text),
                metadata={
                    "style": options.style,
                    "focus": options.focus,
                    "target_compression_ratio": options.compression_ratio,
                    "num_chunks": len(chunks),
                    "hierarchical": True
                }
            )
        else:
            # Only one chunk, return its summary
            return Summary(
                text=intermediate_summaries[0],
                original_length=len(text),
                summary_length=len(intermediate_summaries[0]),
                compression_ratio=len(intermediate_summaries[0]) / len(text),
                metadata={
                    "style": options.style,
                    "focus": options.focus,
                    "target_compression_ratio": options.compression_ratio,
                    "num_chunks": 1,
                    "hierarchical": False
                }
            )
    
    def _split_into_chunks(self, text: str, chunk_size: int) -> List[str]:
        """Split text into chunks of approximately chunk_size characters.
        
        Args:
            text: Text to split
            chunk_size: Approximate size of each chunk
            
        Returns:
            List of text chunks
        """
        # First, try to split by paragraphs
        paragraphs = text.split("\n\n")
        
        chunks = []
        current_chunk = ""
        
        for paragraph in paragraphs:
            # If adding this paragraph would exceed the chunk size and we already have content
            if len(current_chunk) + len(paragraph) > chunk_size and current_chunk:
                chunks.append(current_chunk)
                current_chunk = paragraph
            else:
                # Add paragraph to current chunk
                if current_chunk:
                    current_chunk += "\n\n" + paragraph
                else:
                    current_chunk = paragraph
        
        # Add the last chunk if not empty
        if current_chunk:
            chunks.append(current_chunk)
        
        # If any chunk is still too large, split it further
        result = []
        for chunk in chunks:
            if len(chunk) > chunk_size:
                # Split by sentences
                sentences = self._split_into_sentences(chunk)
                
                # Combine sentences into chunks of appropriate size
                subchunk = ""
                for sentence in sentences:
                    if len(subchunk) + len(sentence) > chunk_size and subchunk:
                        result.append(subchunk)
                        subchunk = sentence
                    else:
                        if subchunk:
                            subchunk += " " + sentence
                        else:
                            subchunk = sentence
                
                # Add the last subchunk if not empty
                if subchunk:
                    result.append(subchunk)
            else:
                result.append(chunk)
        
        return result
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences.
        
        Args:
            text: Text to split
            
        Returns:
            List of sentences
        """
        # Simple regex-based sentence splitter
        sentence_endings = r'(?<=[.!?])\s+'
        sentences = re.split(sentence_endings, text)
        
        # Remove empty sentences
        return [s.strip() for s in sentences if s.strip()]
    
    def _find_sentence_boundary(self, text: str, target_length: int) -> int:
        """Find the nearest sentence boundary to target_length.
        
        Args:
            text: Text to search in
            target_length: Target length to find boundary near
            
        Returns:
            Index of sentence boundary, or -1 if not found
        """
        if target_length >= len(text):
            return len(text)
        
        # Look for sentence-ending punctuation before target length
        for i in range(target_length, max(0, target_length - 100), -1):
            if i < len(text) and text[i] in ['.', '!', '?'] and (i + 1 == len(text) or text[i + 1].isspace()):
                return i + 1
        
        # If no sentence boundary found, look for line breaks or just cut at target
        for i in range(target_length, max(0, target_length - 50), -1):
            if i < len(text) and text[i] == '\n':
                return i + 1
        
        # Just cut at a word boundary near target
        for i in range(target_length, max(0, target_length - 20), -1):
            if i < len(text) and text[i].isspace():
                return i + 1
        
        # If all else fails, just return target_length
        return target_length
    
    def summarize_chunks(
        self,
        chunks: List[TextChunk],
        options: Optional[SummaryOptions] = None
    ) -> Summary:
        """Summarize a list of text chunks.
        
        Args:
            chunks: Chunks to summarize
            options: Summary options
            
        Returns:
            Generated summary
        """
        if not chunks:
            return Summary(
                text="",
                original_length=0,
                summary_length=0,
                compression_ratio=0.0
            )
        
        # Use default options if not provided
        if options is None:
            options = SummaryOptions()
        
        # Combine chunks into a single text
        combined_text = "\n\n".join([chunk.text for chunk in chunks])
        original_length = len(combined_text)
        
        # Check if combined text is short enough to return as is
        if original_length <= options.max_length:
            return Summary(
                text=combined_text,
                original_length=original_length,
                summary_length=original_length,
                compression_ratio=1.0
            )
        
        # Generate summary
        return self.summarize(combined_text, options) 