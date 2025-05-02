import { useState, useEffect } from 'react';

interface OnboardingState {
  isOnboardingOpen: boolean;
  hasOnboarded: boolean;
  completeOnboarding: () => void;
  reopenOnboarding: () => void;
  closeOnboarding: () => void;
}

export function useOnboarding(): OnboardingState {
  // Initialize state from localStorage if available
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const storedValue = localStorage.getItem('hasOnboarded');
      return storedValue ? JSON.parse(storedValue) : false;
    }
    return false;
  });

  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  // Show onboarding modal on initial load if user hasn't completed onboarding
  useEffect(() => {
    if (!hasOnboarded) {
      setIsOnboardingOpen(true);
    }
  }, [hasOnboarded]);

  // Update localStorage when hasOnboarded changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasOnboarded', JSON.stringify(hasOnboarded));
    }
  }, [hasOnboarded]);

  const completeOnboarding = () => {
    setHasOnboarded(true);
    setIsOnboardingOpen(false);
    
    // In a real app, you would also update this in your database
    // Example: api.updateUser({ hasOnboarded: true })
  };

  const reopenOnboarding = () => {
    setIsOnboardingOpen(true);
  };

  const closeOnboarding = () => {
    setIsOnboardingOpen(false);
  };

  return {
    isOnboardingOpen,
    hasOnboarded,
    completeOnboarding,
    reopenOnboarding,
    closeOnboarding,
  };
} 