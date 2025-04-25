"""
Personalization Integration Module

This module provides a unified interface for personalization features,
integrating user profiles, adaptation, and context awareness.
"""

import os
import time
import logging
from typing import Dict, Any, Optional, List, Tuple, Union

from src.config import load_personalization_config
from src.user_profile import UserProfile, AdaptationManager
from src.user_profile.storage import ProfileStorage, JSONProfileStorage, MemoryProfileStorage
from src.memory import Memory

logger = logging.getLogger(__name__)

class PersonalizationManager:
    """
    Manages personalization across the PersLM system.
    
    This class integrates:
    1. User profile management (loading, saving, updating)
    2. Adaptation of responses
    3. Context collection and management
    4. Integration with memory systems
    """
    
    def __init__(self, memory: Optional[Memory] = None):
        """
        Initialize the personalization manager.
        
        Args:
            memory: Memory instance to use, or None to create a new one
        """
        self.config = load_personalization_config()
        self.memory = memory or Memory()
        
        # Initialize storage
        self._init_storage()
        
        # Active objects
        self.active_profiles: Dict[str, UserProfile] = {}
        self.adaptation_managers: Dict[str, AdaptationManager] = {}
        self.current_context: Dict[str, Any] = {}
        
        logger.info("PersonalizationManager initialized")
    
    def _init_storage(self) -> None:
        """Initialize the profile storage system based on configuration."""
        storage_type = self.config.get("user_profile", {}).get("storage", {}).get("type", "memory")
        storage_path = self.config.get("user_profile", {}).get("storage", {}).get("path", "data/profiles")
        
        if storage_type == "json":
            # Ensure directory exists
            os.makedirs(storage_path, exist_ok=True)
            self.profile_storage = JSONProfileStorage(storage_path)
            logger.info(f"Using JSON profile storage in {storage_path}")
        else:
            # Default to in-memory storage
            self.profile_storage = MemoryProfileStorage()
            logger.info("Using in-memory profile storage")
    
    def get_profile(self, user_id: str) -> UserProfile:
        """
        Get a user profile, loading it if necessary.
        
        Args:
            user_id: User ID to get profile for
            
        Returns:
            User profile
        """
        if user_id in self.active_profiles:
            return self.active_profiles[user_id]
            
        # Load profile from storage or create new
        try:
            profile = self.profile_storage.load_profile(user_id)
            logger.info(f"Loaded profile for user {user_id}")
        except Exception as e:
            logger.warning(f"Could not load profile for user {user_id}: {str(e)}")
            logger.info(f"Creating new profile for user {user_id}")
            profile = UserProfile(user_id=user_id)
            
        self.active_profiles[user_id] = profile
        return profile
    
    def save_profile(self, user_id: str) -> bool:
        """
        Save a user profile to storage.
        
        Args:
            user_id: User ID to save profile for
            
        Returns:
            True if successful, False otherwise
        """
        if user_id not in self.active_profiles:
            logger.warning(f"Cannot save profile for user {user_id}: not loaded")
            return False
            
        try:
            self.profile_storage.save_profile(self.active_profiles[user_id])
            logger.info(f"Saved profile for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error saving profile for user {user_id}: {str(e)}")
            return False
    
    def get_adaptation_manager(self, user_id: str) -> AdaptationManager:
        """
        Get an adaptation manager for a user, creating it if necessary.
        
        Args:
            user_id: User ID to get adaptation manager for
            
        Returns:
            Adaptation manager for the user
        """
        if user_id in self.adaptation_managers:
            return self.adaptation_managers[user_id]
            
        # Create new adaptation manager
        profile = self.get_profile(user_id)
        
        # Extract adaptation configuration
        adaptation_config = self.config.get("adaptation", {})
        
        # Create adaptation manager
        manager = AdaptationManager(
            user_profile=profile,
            memory=self.memory,
            config=adaptation_config
        )
        
        self.adaptation_managers[user_id] = manager
        return manager
    
    def collect_context(self) -> Dict[str, Any]:
        """
        Collect current context information.
        
        Returns:
            Dictionary of context information
        """
        # For now, just a simple implementation
        # In a real system, this would gather information from various sources
        
        context = {}
        
        # Check which context collectors are enabled
        context_config = self.config.get("context", {}).get("collection", {})
        
        # Time of day
        if context_config.get("time_of_day", True):
            hour = time.localtime().tm_hour
            if 5 <= hour < 12:
                time_of_day = "morning"
            elif 12 <= hour < 17:
                time_of_day = "afternoon"
            elif 17 <= hour < 22:
                time_of_day = "evening"
            else:
                time_of_day = "night"
                
            context["time_of_day"] = time_of_day
        
        # Device info would be collected here
        # Location would be collected here if enabled
        
        # Store the collected context
        self.current_context = context
        return context
    
    def personalize_response(
        self, 
        user_id: str, 
        response: str,
        query: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Personalize a response for a specific user.
        
        Args:
            user_id: User ID to personalize for
            response: Original response to personalize
            query: User query that generated the response
            context: Optional additional context, will be merged with system context
            
        Returns:
            Personalized response
        """
        # Get adaptation manager
        manager = self.get_adaptation_manager(user_id)
        
        # Collect context if not provided
        if context is None:
            context = {}
            
        # Merge with system context
        full_context = {**self.current_context, **context}
        
        # Adapt response
        personalized_response = manager.adapt_response(
            response=response,
            query=query,
            context=full_context
        )
        
        # Record interaction
        profile = self.get_profile(user_id)
        profile.add_interaction("response", {
            "query": query,
            "original_response": response,
            "personalized_response": personalized_response,
            "context": full_context
        })
        
        # Save profile periodically
        update_frequency = self.config.get("user_profile", {}).get("inference", {}).get("update_frequency", 5)
        interaction_count = len(profile.interaction_history.interactions)
        
        if interaction_count % update_frequency == 0:
            self.save_profile(user_id)
        
        return personalized_response
    
    def process_feedback(
        self,
        user_id: str,
        feedback_type: str,
        feedback_data: Dict[str, Any]
    ) -> None:
        """
        Process user feedback to improve personalization.
        
        Args:
            user_id: User ID the feedback is for
            feedback_type: Type of feedback (e.g., "preference", "response_quality")
            feedback_data: Feedback data content
        """
        profile = self.get_profile(user_id)
        
        # Update profile with feedback
        profile.update_from_feedback(feedback_type, feedback_data)
        
        # If this is adaptation strategy feedback, update the adaptation manager
        if feedback_type == "adaptation_feedback" and "strategy_effectiveness" in feedback_data:
            manager = self.get_adaptation_manager(user_id)
            manager.update_adaptation_strategy(feedback_data)
        
        # Save profile after feedback
        self.save_profile(user_id)
        
        logger.info(f"Processed {feedback_type} feedback for user {user_id}")


# Global personalization manager instance
personalization_manager = PersonalizationManager() 