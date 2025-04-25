"""
User Profile Module for PersLM

This package implements user profiling capabilities for personalization,
adapting to individual user preferences, behaviors, and goals.

Key components:
- Profile: Core user profile data structure
- Storage: Profile persistence and retrieval
- Adaptation: Learning and updating from user interactions
- Personalization: Adapting model behavior based on profiles
"""

from src.user_profile.profile import UserProfile, ProfileItem, Preference, UserTrait
from src.user_profile.storage import ProfileStorage, JSONProfileStorage, MemoryProfileStorage
from src.user_profile.adaptation import AdaptationManager
from src.user_profile.inference import PersonalizationManager 