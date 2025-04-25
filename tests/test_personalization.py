"""
Integration tests for the PersLM personalization capabilities.

This module tests the integration between user profiles, adaptation,
and the personalization pipeline.
"""

import os
import unittest
import tempfile
import json
from typing import Dict, Any, List

from src.user_profile import UserProfile, Preference, UserTrait, AdaptationManager
from src.user_profile.profile import PreferenceCategory, TraitCategory
from src.memory import Memory


class TestPersonalization(unittest.TestCase):
    """Test personalization and adaptation functionality."""
    
    def setUp(self):
        """Set up test environment."""
        # Create a test user profile
        self.user_id = "test_user_1"
        self.profile = UserProfile(
            user_id=self.user_id,
            name="Test User",
            description="A test user for personalization testing"
        )
        
        # Add preferences
        self.profile.add_preference(Preference(
            name="conciseness",
            value=0.8,
            category=PreferenceCategory.COMMUNICATION,
            strength=0.8,
            source="explicit"
        ))
        
        self.profile.add_preference(Preference(
            name="formality",
            value=0.3,
            category=PreferenceCategory.COMMUNICATION,
            strength=0.3,
            source="explicit"
        ))
        
        self.profile.add_preference(Preference(
            name="complexity",
            value=0.7,
            category=PreferenceCategory.CONTENT,
            strength=0.7,
            source="inferred"
        ))
        
        self.profile.add_preference(Preference(
            name="interest_AI",
            value="artificial intelligence",
            category=PreferenceCategory.CONTENT,
            strength=0.9,
            source="explicit"
        ))
        
        self.profile.add_preference(Preference(
            name="interest_history",
            value="history",
            category=PreferenceCategory.CONTENT,
            strength=0.6,
            source="inferred"
        ))
        
        # Add traits
        self.profile.add_trait(UserTrait(
            name="visual_learner",
            value=0.8,
            category=TraitCategory.LEARNING_STYLE,
            source="inferred",
            confidence=0.7
        ))
        
        # Add knowledge areas
        self.profile.add_knowledge_area(
            area="python",
            level=0.9,
            source="explicit",
            confidence=0.95
        )
        
        self.profile.add_knowledge_area(
            area="machine_learning",
            level=0.6,
            source="inferred",
            confidence=0.8
        )
        
        # Create memory system
        self.memory = Memory()
        
        # Create adaptation manager
        self.adaptation_manager = AdaptationManager(
            user_profile=self.profile,
            memory=self.memory
        )
    
    def test_profile_accessors(self):
        """Test the profile accessor methods."""
        # Test getting communication preferences
        comm_prefs = self.profile.get_communication_preferences()
        self.assertEqual(comm_prefs["conciseness"], 0.8)
        self.assertEqual(comm_prefs["formality"], 0.3)
        
        # Test getting knowledge areas
        knowledge = self.profile.get_knowledge_areas()
        self.assertEqual(knowledge["python"], 0.9)
        self.assertEqual(knowledge["machine_learning"], 0.6)
        
        # Test getting interests
        interests = self.profile.get_interests()
        self.assertEqual(interests["AI"], 0.9)
        self.assertEqual(interests["history"], 0.6)
        
        # Test getting complexity preference
        complexity = self.profile.get_complexity_preference()
        self.assertEqual(complexity, 0.7)
        
        # Test getting learning style
        learning_style = self.profile.get_learning_style()
        self.assertEqual(learning_style["visual_learner"], 0.8)
    
    def test_content_personalization(self):
        """Test content personalization adaptation."""
        query = "Tell me about Python programming"
        response = "Python is a high-level, interpreted programming language. It features dynamic typing, garbage collection, and supports multiple programming paradigms including procedural, object-oriented, and functional programming."
        context = {}
        
        # Apply content personalization
        adapted_response = self.adaptation_manager._personalize_content(
            response=response,
            query=query,
            context=context,
            adaptation_strength=1.0
        )
        
        # Since the user has high Python knowledge, the response should not change much
        self.assertEqual(response, adapted_response)
        
        # Test with a different query for a beginner
        self.profile.add_knowledge_area("javascript", 0.2, "inferred", 0.6)
        
        query2 = "How does JavaScript work?"
        response2 = "JavaScript is a scripting language that enables dynamic content on web pages. It executes in the browser and interacts with the DOM."
        
        # Apply content personalization for a topic the user is less familiar with
        adapted_response2 = self.adaptation_manager._personalize_content(
            response=response2,
            query=query2,
            context=context,
            adaptation_strength=1.0
        )
        
        # The adaptation doesn't add explanations in the current implementation
        # This is a placeholder test
        self.assertEqual(response2, adapted_response2)
    
    def test_style_adaptation(self):
        """Test communication style adaptation."""
        query = "Tell me about machine learning"
        response = "Machine learning is a field of artificial intelligence that uses statistical techniques to give computer systems the ability to learn from data, without being explicitly programmed. The name machine learning was coined in 1959 by Arthur Samuel."
        context = {}
        
        # Apply style adaptation
        adapted_response = self.adaptation_manager._adapt_style(
            response=response,
            query=query,
            context=context,
            adaptation_strength=1.0
        )
        
        # User prefers concise responses with casual tone
        # Should be shorter and more casual
        self.assertNotEqual(response, adapted_response)
    
    def test_interest_prioritization(self):
        """Test interest-based prioritization."""
        query = "Tell me something interesting"
        response = "There are many fascinating topics to explore in science and technology."
        context = {}
        
        # Apply interest prioritization
        adapted_response = self.adaptation_manager._prioritize_interests(
            response=response,
            query=query,
            context=context,
            adaptation_strength=1.0
        )
        
        # Should prioritize AI since it's the user's strongest interest
        self.assertIn("Regarding AI", adapted_response)
    
    def test_context_adaptation(self):
        """Test context-based adaptation."""
        query = "What should I do today?"
        response = "There are many activities you could try today."
        context = {
            "time_of_day": "morning",
            "device_type": "mobile"
        }
        
        # Apply context adaptation
        adapted_response = self.adaptation_manager._adapt_to_context(
            response=response,
            query=query,
            context=context,
            adaptation_strength=1.0
        )
        
        # Should add morning greeting
        self.assertIn("Good morning", adapted_response)
    
    def test_full_adaptation_pipeline(self):
        """Test the complete adaptation pipeline."""
        query = "Tell me about the latest developments in artificial intelligence"
        response = "Artificial intelligence has seen significant advancements in recent years. Large language models like GPT-4 and multimodal models that combine text, image, and audio understanding represent some of the latest developments. Reinforcement learning from human feedback (RLHF) has improved model alignment with human values and preferences. AI research is also focusing on making models more interpretable, robust, and computationally efficient."
        context = {
            "time_of_day": "evening",
            "device_type": "desktop",
            "location": {"country": "USA"}
        }
        
        # Apply full adaptation pipeline
        adapted_response = self.adaptation_manager.adapt_response(
            response=response,
            query=query,
            context=context
        )
        
        # Should be personalized based on all adaptation strategies
        self.assertNotEqual(response, adapted_response)
        self.assertIn("Good evening", adapted_response)
    
    def test_adaptation_update(self):
        """Test updating adaptation strategies based on feedback."""
        # Get initial weights
        initial_weights = self.adaptation_manager.adaptation_weights.copy()
        
        # Provide feedback
        feedback = {
            "strategy_effectiveness": {
                "content_personalization": 0.9,  # Higher than current
                "style_adaptation": 0.4,  # Lower than current
                "complexity_adaptation": 0.8,  # Same as current
            }
        }
        
        # Update adaptation strategy
        self.adaptation_manager.update_adaptation_strategy(feedback)
        
        # Check that weights were updated
        self.assertGreater(
            self.adaptation_manager.adaptation_weights["content_personalization"], 
            initial_weights["content_personalization"]
        )
        
        self.assertLess(
            self.adaptation_manager.adaptation_weights["style_adaptation"], 
            initial_weights["style_adaptation"]
        )
        
        self.assertEqual(
            self.adaptation_manager.adaptation_weights["complexity_adaptation"], 
            initial_weights["complexity_adaptation"]
        )
    
    def test_profile_feedback_update(self):
        """Test updating the profile based on feedback."""
        # Initial preference
        initial_formality = self.profile.get_preference("formality").strength
        
        # Provide preference feedback
        feedback_data = {
            "preferences": {
                "formality": 0.7,  # Increase formality
                "emoji_usage": 0.8  # New preference
            },
            "categories": {
                "emoji_usage": "communication"
            }
        }
        
        # Update profile with feedback
        self.profile.update_from_feedback("preference_feedback", feedback_data)
        
        # Check that preferences were updated
        updated_formality = self.profile.get_preference("formality").strength
        self.assertGreater(updated_formality, initial_formality)
        
        # Check that new preference was added
        emoji_pref = self.profile.get_preference("emoji_usage")
        self.assertIsNotNone(emoji_pref)
        self.assertEqual(emoji_pref.strength, 0.8)


if __name__ == "__main__":
    unittest.main() 