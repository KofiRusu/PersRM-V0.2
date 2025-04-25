"""
Adaptation module for PersLM - handles adaptation of model responses and behavior
based on user profile, preferences, and interaction history.
"""

import os
import time
import json
import logging
from typing import Dict, List, Optional, Any, Tuple, Union
import numpy as np

from src.user_profile.profile import UserProfile
from src.memory import Memory

logger = logging.getLogger(__name__)

class AdaptationManager:
    """
    Manages the adaptation of model behavior based on user profile and interactions.
    
    The AdaptationManager customizes model outputs through various strategies:
    1. Content personalization - adjusting information based on user knowledge and preferences
    2. Style adaptation - matching communication style to user preferences
    3. Complexity adaptation - adjusting explanation depth and complexity
    4. Interest-based prioritization - emphasizing content relevant to user interests
    5. Context-aware responses - adapting based on situational context
    """
    
    def __init__(
        self,
        user_profile: UserProfile,
        memory: Memory,
        config: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize the AdaptationManager.
        
        Args:
            user_profile: UserProfile instance containing user information
            memory: Memory instance for accessing interaction history
            config: Configuration settings for adaptation behavior
        """
        self.user_profile = user_profile
        self.memory = memory
        self.config = config or {}
        
        # Default adaptation weights
        self.adaptation_weights = {
            "content_personalization": 0.7,
            "style_adaptation": 0.6,
            "complexity_adaptation": 0.8,
            "interest_prioritization": 0.7,
            "context_awareness": 0.9
        }
        
        # Override defaults with config values if provided
        if "adaptation_weights" in self.config:
            self.adaptation_weights.update(self.config["adaptation_weights"])
            
        # Initialize adaptation models and state
        self._initialize_adaptation_models()
        
        logger.info("AdaptationManager initialized with %d adaptation strategies", 
                   len(self.adaptation_weights))
    
    def _initialize_adaptation_models(self) -> None:
        """Initialize the adaptation models based on configuration."""
        # Maps adaptation strategy to handler functions
        self.adaptation_handlers = {
            "content_personalization": self._personalize_content,
            "style_adaptation": self._adapt_style,
            "complexity_adaptation": self._adapt_complexity,
            "interest_prioritization": self._prioritize_interests,
            "context_awareness": self._adapt_to_context
        }
        
        # Tracking adaptation effectiveness
        self.adaptation_metrics = {
            strategy: {"success_count": 0, "total_attempts": 0}
            for strategy in self.adaptation_weights.keys()
        }
    
    def adapt_response(
        self, 
        response: str, 
        query: str, 
        context: Dict[str, Any]
    ) -> str:
        """
        Adapt a model response based on user profile and context.
        
        Args:
            response: Original model response
            query: User query that generated the response
            context: Additional context information
            
        Returns:
            Adapted response text
        """
        # Apply each adaptation strategy with its weight
        adapted_response = response
        
        for strategy, weight in self.adaptation_weights.items():
            if weight <= 0:
                continue
                
            handler = self.adaptation_handlers.get(strategy)
            if handler:
                try:
                    adapted_response = handler(
                        adapted_response, 
                        query, 
                        context,
                        adaptation_strength=weight
                    )
                    self.adaptation_metrics[strategy]["total_attempts"] += 1
                    self.adaptation_metrics[strategy]["success_count"] += 1
                except Exception as e:
                    logger.error(f"Error applying {strategy}: {str(e)}")
                    self.adaptation_metrics[strategy]["total_attempts"] += 1
        
        return adapted_response
    
    def _personalize_content(
        self, 
        response: str, 
        query: str, 
        context: Dict[str, Any],
        adaptation_strength: float = 1.0
    ) -> str:
        """
        Personalize content based on user knowledge, preferences, and history.
        
        Args:
            response: Original response
            query: User query
            context: Context information
            adaptation_strength: How strongly to apply this adaptation (0-1)
            
        Returns:
            Content-personalized response
        """
        knowledge_areas = self.user_profile.get_knowledge_areas()
        interests = self.user_profile.get_interests()
        
        # Personalization logic based on domain knowledge
        if knowledge_areas:
            # Adjust explanation depth based on knowledge level
            for area, level in knowledge_areas.items():
                if area.lower() in query.lower() or area.lower() in response.lower():
                    if level > 0.7:  # Expert level
                        # Use more technical language
                        response = self._adjust_technical_depth(response, area, "expert")
                    elif level < 0.3:  # Beginner level
                        # Add more explanations for terms
                        response = self._adjust_technical_depth(response, area, "beginner")
        
        # Add references to past interactions if relevant
        if adaptation_strength > 0.5:
            relevant_memories = self.memory.retrieve_relevant(query, limit=3)
            if relevant_memories:
                for memory in relevant_memories:
                    if self._is_highly_relevant(memory, query) and "Following up on our previous" not in response:
                        response = f"Following up on our previous conversation about {memory['topic']}, {response}"
                        break
        
        return response
    
    def _adjust_technical_depth(
        self, 
        text: str, 
        domain: str, 
        level: str
    ) -> str:
        """
        Adjust the technical depth of explanations based on user expertise.
        
        Args:
            text: Original text
            domain: Knowledge domain
            level: Expertise level (beginner, intermediate, expert)
            
        Returns:
            Adjusted text
        """
        # Implementation would include domain-specific term replacement
        # and explanation adjustment based on expertise level
        if level == "expert":
            # Replace simpler explanations with more technical terminology
            # This is a placeholder for the actual implementation
            return text
        elif level == "beginner":
            # Add explanations for technical terms
            # This is a placeholder for the actual implementation
            return text
        
        return text
    
    def _adapt_style(
        self, 
        response: str, 
        query: str, 
        context: Dict[str, Any],
        adaptation_strength: float = 1.0
    ) -> str:
        """
        Adapt communication style based on user preferences.
        
        Args:
            response: Original response
            query: User query
            context: Context information
            adaptation_strength: How strongly to apply this adaptation (0-1)
            
        Returns:
            Style-adapted response
        """
        style_preferences = self.user_profile.get_communication_preferences()
        
        if not style_preferences:
            return response
            
        # Conciseness adaptation
        if "conciseness" in style_preferences:
            conciseness = style_preferences["conciseness"] * adaptation_strength
            if conciseness > 0.7:
                # Make more concise
                response = self._make_concise(response)
            elif conciseness < 0.3:
                # Make more detailed
                response = self._make_detailed(response)
        
        # Formality adaptation  
        if "formality" in style_preferences:
            formality = style_preferences["formality"] * adaptation_strength
            if formality > 0.7:
                # Make more formal
                response = self._adjust_formality(response, "formal")
            elif formality < 0.3:
                # Make more casual
                response = self._adjust_formality(response, "casual")
                
        return response
    
    def _make_concise(self, text: str) -> str:
        """Make text more concise by removing unnecessary elaboration."""
        # This would implement text summarization techniques
        # For now, this is a simple placeholder
        if len(text) > 1000:
            sentences = text.split('.')
            if len(sentences) > 5:
                return '.'.join(sentences[:len(sentences)//2]) + '.'
        return text
    
    def _make_detailed(self, text: str) -> str:
        """Elaborate on text with more details."""
        # This would implement text expansion techniques
        # For now, this is a simple placeholder
        return text
    
    def _adjust_formality(self, text: str, target_formality: str) -> str:
        """Adjust the formality level of text."""
        # This would implement style transfer techniques
        # For now, this is a simple placeholder
        if target_formality == "formal":
            # Replace casual phrases with formal alternatives
            text = text.replace("yeah", "yes")
            text = text.replace("nope", "no")
            text = text.replace("gonna", "going to")
        elif target_formality == "casual":
            # Replace formal phrases with casual alternatives
            text = text.replace("I would recommend", "I'd recommend")
            text = text.replace("I will", "I'll")
        return text
    
    def _adapt_complexity(
        self, 
        response: str, 
        query: str, 
        context: Dict[str, Any],
        adaptation_strength: float = 1.0
    ) -> str:
        """
        Adapt complexity of response based on user preferences and history.
        
        Args:
            response: Original response
            query: User query
            context: Context information
            adaptation_strength: How strongly to apply this adaptation (0-1)
            
        Returns:
            Complexity-adapted response
        """
        complexity_preference = self.user_profile.get_complexity_preference()
        if not complexity_preference:
            return response
            
        # Scale by adaptation strength
        target_complexity = complexity_preference * adaptation_strength
        
        # Simplify or increase complexity based on preference
        if target_complexity < 0.4:
            # Simplify vocabulary and sentence structure
            response = self._simplify_text(response)
        elif target_complexity > 0.7:
            # Increase vocabulary complexity and add nuance
            response = self._increase_complexity(response)
            
        return response
    
    def _simplify_text(self, text: str) -> str:
        """Simplify text by reducing sentence complexity and vocabulary level."""
        # This would implement text simplification techniques
        # For now, this is a simple placeholder
        return text
    
    def _increase_complexity(self, text: str) -> str:
        """Increase text complexity with more sophisticated vocabulary and structure."""
        # This would implement text complexity enhancement techniques
        # For now, this is a simple placeholder
        return text
    
    def _prioritize_interests(
        self, 
        response: str, 
        query: str, 
        context: Dict[str, Any],
        adaptation_strength: float = 1.0
    ) -> str:
        """
        Prioritize content related to user interests.
        
        Args:
            response: Original response
            query: User query
            context: Context information
            adaptation_strength: How strongly to apply this adaptation (0-1)
            
        Returns:
            Interest-prioritized response
        """
        interests = self.user_profile.get_interests()
        if not interests:
            return response
            
        # Find relevant interests to the current query/response
        relevant_interests = []
        for interest, score in interests.items():
            if interest.lower() in query.lower() or interest.lower() in response.lower():
                relevant_interests.append((interest, score * adaptation_strength))
                
        if not relevant_interests:
            return response
            
        # Sort by interest score (highest first)
        relevant_interests.sort(key=lambda x: x[1], reverse=True)
        
        # For the top interests, ensure they're prominently featured in the response
        for interest, score in relevant_interests[:2]:
            if score > 0.6 and interest.lower() not in response.lower()[:100]:
                # Add a reference to this interest early in the response if not already there
                response = f"Regarding {interest}, {response}"
                break
                
        return response
    
    def _adapt_to_context(
        self, 
        response: str, 
        query: str, 
        context: Dict[str, Any],
        adaptation_strength: float = 1.0
    ) -> str:
        """
        Adapt response based on contextual factors (time, location, device, etc).
        
        Args:
            response: Original response
            query: User query
            context: Context information
            adaptation_strength: How strongly to apply this adaptation (0-1)
            
        Returns:
            Context-adapted response
        """
        if not context:
            return response
            
        # Time-based adaptation
        if "time_of_day" in context:
            time_of_day = context["time_of_day"]
            if time_of_day == "morning" and "good morning" not in response.lower():
                response = f"Good morning! {response}"
            elif time_of_day == "evening" and "good evening" not in response.lower():
                response = f"Good evening! {response}"
                
        # Device-based adaptation
        if "device_type" in context:
            device_type = context["device_type"]
            if device_type == "mobile" and len(response) > 500 * (1 - adaptation_strength):
                # Shorten response for mobile devices based on adaptation strength
                response = self._make_concise(response)
                
        # Location-based adaptation
        if "location" in context and adaptation_strength > 0.5:
            location = context["location"]
            if location.get("country") and "local_reference" not in context:
                # Add culturally relevant references or examples
                # This would be expanded with actual cultural adaptation logic
                pass
                
        return response
    
    def _is_highly_relevant(self, memory: Dict[str, Any], query: str) -> bool:
        """
        Determine if a memory is highly relevant to the current query.
        
        Args:
            memory: Memory item
            query: Current user query
            
        Returns:
            True if highly relevant, False otherwise
        """
        # Calculate relevance score based on semantic similarity
        # This is a placeholder for actual relevance calculation
        relevance_threshold = 0.7
        
        # Simple keyword matching for now
        query_words = set(query.lower().split())
        memory_words = set(memory.get("query", "").lower().split())
        
        word_overlap = len(query_words.intersection(memory_words)) / max(len(query_words), 1)
        return word_overlap > relevance_threshold
        
    def update_adaptation_strategy(
        self,
        feedback: Dict[str, Any]
    ) -> None:
        """
        Update adaptation strategies based on user feedback.
        
        Args:
            feedback: Feedback information about adaptation effectiveness
        """
        if "strategy_effectiveness" in feedback:
            for strategy, score in feedback["strategy_effectiveness"].items():
                if strategy in self.adaptation_weights:
                    # Gradually adjust weights based on feedback
                    current_weight = self.adaptation_weights[strategy]
                    # Adjust by at most 10% in either direction
                    adjustment = min(0.1, abs(score - current_weight) / 2) * (1 if score > current_weight else -1)
                    self.adaptation_weights[strategy] = max(0, min(1, current_weight + adjustment))
        
        logger.info("Updated adaptation weights: %s", self.adaptation_weights)
    
    def get_adaptation_metrics(self) -> Dict[str, Any]:
        """
        Get metrics on adaptation strategy effectiveness.
        
        Returns:
            Dictionary of adaptation metrics
        """
        metrics = {}
        
        for strategy, data in self.adaptation_metrics.items():
            if data["total_attempts"] > 0:
                success_rate = data["success_count"] / data["total_attempts"]
            else:
                success_rate = 0.0
                
            metrics[strategy] = {
                "success_rate": success_rate,
                "weight": self.adaptation_weights[strategy],
                "total_attempts": data["total_attempts"]
            }
            
        return metrics 