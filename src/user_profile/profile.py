"""
User Profile Definitions

This module defines the core data structures for user profiling and personalization.
"""

import time
from enum import Enum
from typing import Dict, List, Optional, Any, Set, Union
from dataclasses import dataclass, field, asdict

@dataclass
class ProfileItem:
    """Base class for profile items."""
    name: str
    value: Any
    source: str = "system"  # system, explicit, inferred
    confidence: float = 1.0  # 0-1 confidence score
    timestamp: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "value": self.value,
            "source": self.source,
            "confidence": self.confidence,
            "timestamp": self.timestamp,
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ProfileItem':
        """Create from dictionary."""
        return cls(**data)


class PreferenceCategory(Enum):
    """Categories of user preferences."""
    COMMUNICATION = "communication"
    CONTENT = "content"
    INTERFACE = "interface"
    INTERACTION = "interaction"
    PRIVACY = "privacy"
    WORK_STYLE = "work_style"
    TECHNICAL = "technical"
    DOMAIN = "domain"


@dataclass
class Preference(ProfileItem):
    """User preference item."""
    category: Union[PreferenceCategory, str] = PreferenceCategory.COMMUNICATION
    strength: float = 0.5  # 0-1 preference strength
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = super().to_dict()
        if isinstance(self.category, PreferenceCategory):
            result["category"] = self.category.value
        else:
            result["category"] = self.category
        result["strength"] = self.strength
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Preference':
        """Create from dictionary."""
        data = data.copy()
        category = data.pop("category", "communication")
        try:
            data["category"] = PreferenceCategory(category)
        except (ValueError, TypeError):
            data["category"] = category
        
        return cls(**data)


class TraitCategory(Enum):
    """Categories of user traits."""
    PERSONALITY = "personality"
    LEARNING_STYLE = "learning_style"
    COGNITIVE = "cognitive"
    EXPERTISE = "expertise"
    DEMOGRAPHIC = "demographic"


@dataclass
class UserTrait(ProfileItem):
    """User trait item."""
    category: Union[TraitCategory, str] = TraitCategory.PERSONALITY
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = super().to_dict()
        if isinstance(self.category, TraitCategory):
            result["category"] = self.category.value
        else:
            result["category"] = self.category
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UserTrait':
        """Create from dictionary."""
        data = data.copy()
        category = data.pop("category", "personality")
        try:
            data["category"] = TraitCategory(category)
        except (ValueError, TypeError):
            data["category"] = category
        
        return cls(**data)


@dataclass
class Goal:
    """User goal."""
    name: str
    description: str
    priority: int = 1  # Higher is more important
    status: str = "active"  # active, completed, abandoned
    progress: float = 0.0  # 0-1 progress toward goal
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    deadline: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Goal':
        """Create from dictionary."""
        return cls(**data)


@dataclass
class InteractionHistory:
    """History of user interactions."""
    interactions: List[Dict[str, Any]] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    last_updated: float = field(default_factory=time.time)
    
    def add_interaction(self, interaction_type: str, data: Dict[str, Any]) -> int:
        """Add an interaction to history.
        
        Args:
            interaction_type: Type of interaction
            data: Interaction data
            
        Returns:
            Index of the added interaction
        """
        interaction = {
            "type": interaction_type,
            "timestamp": time.time(),
            "data": data
        }
        
        self.interactions.append(interaction)
        self.last_updated = time.time()
        
        # Update summary
        self._update_summary()
        
        return len(self.interactions) - 1
    
    def _update_summary(self) -> None:
        """Update interaction summary statistics."""
        if not self.interactions:
            self.summary = {}
            return
        
        # Count by type
        type_counts = {}
        for interaction in self.interactions:
            type_counts[interaction["type"]] = type_counts.get(interaction["type"], 0) + 1
        
        # Calculate recency
        current_time = time.time()
        interaction_times = [interaction["timestamp"] for interaction in self.interactions]
        latest_time = max(interaction_times)
        earliest_time = min(interaction_times)
        
        self.summary = {
            "count": len(self.interactions),
            "type_counts": type_counts,
            "latest": latest_time,
            "earliest": earliest_time,
            "duration": latest_time - earliest_time if len(interaction_times) > 1 else 0,
            "recency": current_time - latest_time
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'InteractionHistory':
        """Create from dictionary."""
        return cls(**data)


class UserProfile:
    """User profile containing traits, preferences, goals, and interaction history."""
    
    def __init__(
        self, 
        user_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Initialize a user profile.
        
        Args:
            user_id: Unique identifier for the user
            name: User's name
            description: Description of the user
            metadata: Additional metadata
        """
        self.user_id = user_id
        self.name = name or user_id
        self.description = description or ""
        self.metadata = metadata or {}
        self.created_at = time.time()
        self.updated_at = time.time()
        
        # Core profile components
        self.preferences: Dict[str, Preference] = {}
        self.traits: Dict[str, UserTrait] = {}
        self.goals: Dict[str, Goal] = {}
        self.interaction_history = InteractionHistory()
        
        # Advanced profile information
        self.personas: Dict[str, Dict[str, Any]] = {}
        self.knowledge_areas: Dict[str, Dict[str, Any]] = {}
    
    def add_preference(self, preference: Preference) -> None:
        """Add a preference to the profile.
        
        Args:
            preference: Preference to add
        """
        self.preferences[preference.name] = preference
        self.updated_at = time.time()
    
    def add_trait(self, trait: UserTrait) -> None:
        """Add a trait to the profile.
        
        Args:
            trait: Trait to add
        """
        self.traits[trait.name] = trait
        self.updated_at = time.time()
    
    def add_goal(self, goal: Goal) -> None:
        """Add a goal to the profile.
        
        Args:
            goal: Goal to add
        """
        self.goals[goal.name] = goal
        self.updated_at = time.time()
    
    def update_goal_progress(self, goal_name: str, progress: float) -> bool:
        """Update the progress of a goal.
        
        Args:
            goal_name: Name of the goal
            progress: New progress value (0-1)
            
        Returns:
            True if the goal was updated, False if not found
        """
        if goal_name not in self.goals:
            return False
        
        goal = self.goals[goal_name]
        goal.progress = max(0.0, min(1.0, progress))  # Clamp to 0-1
        goal.updated_at = time.time()
        self.updated_at = time.time()
        
        # Mark as completed if reached 100%
        if goal.progress >= 1.0:
            goal.status = "completed"
        
        return True
    
    def add_interaction(self, interaction_type: str, data: Dict[str, Any]) -> int:
        """Add an interaction to history.
        
        Args:
            interaction_type: Type of interaction
            data: Interaction data
            
        Returns:
            Index of the added interaction
        """
        result = self.interaction_history.add_interaction(interaction_type, data)
        self.updated_at = time.time()
        return result
    
    def add_persona(
        self, 
        name: str, 
        description: str, 
        traits: Dict[str, Any] = None,
        preferences: Dict[str, Any] = None
    ) -> None:
        """Add a persona to the profile.
        
        A persona is a contextual set of traits and preferences for different situations.
        
        Args:
            name: Persona name
            description: Persona description
            traits: Traits specific to this persona
            preferences: Preferences specific to this persona
        """
        self.personas[name] = {
            "name": name,
            "description": description,
            "traits": traits or {},
            "preferences": preferences or {},
            "created_at": time.time()
        }
        self.updated_at = time.time()
    
    def get_preference(self, name: str) -> Optional[Preference]:
        """Get a preference by name.
        
        Args:
            name: Preference name
            
        Returns:
            Preference or None if not found
        """
        return self.preferences.get(name)
    
    def get_trait(self, name: str) -> Optional[UserTrait]:
        """Get a trait by name.
        
        Args:
            name: Trait name
            
        Returns:
            UserTrait or None if not found
        """
        return self.traits.get(name)
    
    def get_goal(self, name: str) -> Optional[Goal]:
        """Get a goal by name.
        
        Args:
            name: Goal name
            
        Returns:
            Goal or None if not found
        """
        return self.goals.get(name)
    
    def get_active_goals(self) -> List[Goal]:
        """Get all active goals.
        
        Returns:
            List of active goals
        """
        return [goal for goal in self.goals.values() if goal.status == "active"]
    
    def get_preferences_by_category(self, category: Union[PreferenceCategory, str]) -> List[Preference]:
        """Get preferences by category.
        
        Args:
            category: Preference category
            
        Returns:
            List of preferences in the category
        """
        if isinstance(category, PreferenceCategory):
            category_value = category.value
        else:
            category_value = category
        
        return [
            pref for pref in self.preferences.values() 
            if (isinstance(pref.category, PreferenceCategory) and pref.category.value == category_value) or
               (isinstance(pref.category, str) and pref.category == category_value)
        ]
    
    def get_traits_by_category(self, category: Union[TraitCategory, str]) -> List[UserTrait]:
        """Get traits by category.
        
        Args:
            category: Trait category
            
        Returns:
            List of traits in the category
        """
        if isinstance(category, TraitCategory):
            category_value = category.value
        else:
            category_value = category
        
        return [
            trait for trait in self.traits.values() 
            if (isinstance(trait.category, TraitCategory) and trait.category.value == category_value) or
               (isinstance(trait.category, str) and trait.category == category_value)
        ]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert profile to dictionary.
        
        Returns:
            Dictionary representation of the profile
        """
        return {
            "user_id": self.user_id,
            "name": self.name,
            "description": self.description,
            "metadata": self.metadata,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "preferences": {name: pref.to_dict() for name, pref in self.preferences.items()},
            "traits": {name: trait.to_dict() for name, trait in self.traits.items()},
            "goals": {name: goal.to_dict() for name, goal in self.goals.items()},
            "interaction_history": self.interaction_history.to_dict(),
            "personas": self.personas,
            "knowledge_areas": self.knowledge_areas
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UserProfile':
        """Create profile from dictionary.
        
        Args:
            data: Dictionary representation of a profile
            
        Returns:
            UserProfile instance
        """
        profile = cls(
            user_id=data["user_id"],
            name=data.get("name"),
            description=data.get("description"),
            metadata=data.get("metadata", {})
        )
        
        profile.created_at = data.get("created_at", time.time())
        profile.updated_at = data.get("updated_at", time.time())
        
        # Load preferences
        for name, pref_data in data.get("preferences", {}).items():
            profile.preferences[name] = Preference.from_dict(pref_data)
        
        # Load traits
        for name, trait_data in data.get("traits", {}).items():
            profile.traits[name] = UserTrait.from_dict(trait_data)
        
        # Load goals
        for name, goal_data in data.get("goals", {}).items():
            profile.goals[name] = Goal.from_dict(goal_data)
        
        # Load interaction history
        if "interaction_history" in data:
            profile.interaction_history = InteractionHistory.from_dict(data["interaction_history"])
        
        # Load personas and knowledge areas
        profile.personas = data.get("personas", {})
        profile.knowledge_areas = data.get("knowledge_areas", {})
        
        return profile 

    def add_knowledge_area(
        self, 
        area: str, 
        level: float, 
        source: str = "inferred",
        confidence: float = 0.7
    ) -> None:
        """
        Add or update a knowledge area for the user.
        
        Args:
            area: Knowledge domain/area name
            level: Proficiency level (0-1)
            source: How this knowledge was determined
            confidence: Confidence in this assessment
        """
        self.knowledge_areas[area] = {
            "level": level,
            "source": source,
            "confidence": confidence,
            "timestamp": time.time()
        }
        self.updated_at = time.time()
    
    def get_knowledge_areas(self) -> Dict[str, float]:
        """
        Get the user's knowledge areas and proficiency levels.
        
        Returns:
            Dictionary mapping knowledge areas to proficiency levels
        """
        return {area: info["level"] for area, info in self.knowledge_areas.items()}

    def get_interests(self) -> Dict[str, float]:
        """
        Get the user's interests and their importance scores.
        
        Returns:
            Dictionary mapping interests to importance scores (0-1)
        """
        interests = {}
        for name, pref in self.preferences.items():
            if isinstance(pref.category, PreferenceCategory) and pref.category == PreferenceCategory.CONTENT:
                if pref.name.startswith("interest_"):
                    interest_name = pref.name[9:]  # Remove "interest_" prefix
                    interests[interest_name] = pref.strength
                elif "interest" in pref.metadata:
                    interests[pref.name] = pref.strength
        
        return interests
    
    def get_communication_preferences(self) -> Dict[str, float]:
        """
        Get the user's communication style preferences.
        
        Returns:
            Dictionary mapping communication aspects to preference values
        """
        comm_prefs = {}
        for name, pref in self.preferences.items():
            if isinstance(pref.category, PreferenceCategory) and pref.category == PreferenceCategory.COMMUNICATION:
                comm_prefs[pref.name] = pref.strength
        
        return comm_prefs
    
    def get_complexity_preference(self) -> Optional[float]:
        """
        Get the user's preferred explanation complexity level.
        
        Returns:
            Complexity preference value (0-1) or None if not set
        """
        complexity_pref = self.get_preference("complexity")
        if complexity_pref:
            return complexity_pref.strength
        return None
    
    def get_learning_style(self) -> Dict[str, float]:
        """
        Get the user's learning style traits.
        
        Returns:
            Dictionary mapping learning style dimensions to values
        """
        learning_style = {}
        for name, trait in self.traits.items():
            if isinstance(trait.category, TraitCategory) and trait.category == TraitCategory.LEARNING_STYLE:
                learning_style[trait.name] = trait.value
        
        return learning_style
    
    def update_from_feedback(
        self, 
        feedback_type: str, 
        feedback_data: Dict[str, Any]
    ) -> None:
        """
        Update profile based on user feedback.
        
        Args:
            feedback_type: Type of feedback received
            feedback_data: Feedback data content
        """
        self.add_interaction("feedback", {
            "type": feedback_type,
            "data": feedback_data
        })
        
        # Update preferences based on feedback
        if feedback_type == "preference_feedback":
            for pref_name, pref_value in feedback_data.get("preferences", {}).items():
                existing_pref = self.get_preference(pref_name)
                if existing_pref:
                    # Adjust existing preference
                    self.preferences[pref_name].strength = pref_value
                    self.preferences[pref_name].source = "explicit"
                    self.preferences[pref_name].confidence = 1.0
                    self.preferences[pref_name].timestamp = time.time()
                else:
                    # Create new preference
                    category = feedback_data.get("categories", {}).get(pref_name, PreferenceCategory.COMMUNICATION)
                    new_pref = Preference(
                        name=pref_name,
                        value=pref_value,
                        category=category,
                        strength=pref_value,
                        source="explicit",
                        confidence=1.0
                    )
                    self.add_preference(new_pref)
        
        # Update knowledge areas based on feedback
        if feedback_type == "knowledge_feedback":
            for area, level in feedback_data.get("knowledge_areas", {}).items():
                self.add_knowledge_area(area, level, source="explicit", confidence=1.0)
        
        self.updated_at = time.time() 