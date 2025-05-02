import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui';
import { Button } from '@/components/ui';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';

type OnboardingSlide = {
  title: string;
  description: string;
  image?: string;
};

const slides: OnboardingSlide[] = [
  {
    title: "Welcome to OFAuto Beta!",
    description: "We're excited to have you join our beta testing program. Let's take a quick tour of what OFAuto has to offer.",
    image: "/images/welcome.svg",
  },
  {
    title: "Powerful Analytics",
    description: "Gain valuable insights with our advanced analytics dashboard, designed to help you optimize your workflow.",
    image: "/images/analytics.svg",
  },
  {
    title: "Intelligent Automation",
    description: "Our AI-powered automation tools streamline your processes and save you valuable time.",
    image: "/images/automation.svg",
  },
  {
    title: "Customizable Workspace",
    description: "Configure your workspace to suit your unique needs and preferences.",
    image: "/images/workspace.svg",
  },
  {
    title: "Complete Your Profile",
    description: "Set up your profile to get the most out of OFAuto and personalize your experience.",
    image: "/images/profile.svg",
  },
];

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onClose: () => void;
}

export function OnboardingModal({ isOpen, onComplete, onClose }: OnboardingModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [profileName, setProfileName] = useState('');
  const [profileRole, setProfileRole] = useState('');

  const isLastSlide = currentSlide === slides.length - 1;
  const isProfileSlide = isLastSlide;

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleComplete = () => {
    // Handle completing the onboarding process
    onComplete();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {slides[currentSlide].title}
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {slides[currentSlide].description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-6">
          {slides[currentSlide].image && (
            <div className="w-64 h-64 flex items-center justify-center">
              <img 
                src={slides[currentSlide].image} 
                alt={slides[currentSlide].title}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}

          {isProfileSlide && (
            <div className="w-full max-w-md space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium">
                  Your Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your name"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="role" className="block text-sm font-medium">
                  Your Role
                </label>
                <input
                  type="text"
                  id="role"
                  value={profileRole}
                  onChange={(e) => setProfileRole(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your role"
                />
              </div>
            </div>
          )}
        </div>

        {/* Progress indicators */}
        <div className="flex justify-center space-x-2 pb-4">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full ${
                index === currentSlide ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentSlide === 0}
            className="flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </Button>
          
          <Button
            onClick={handleNext}
            className="flex items-center gap-1"
            disabled={isProfileSlide && (!profileName || !profileRole)}
          >
            {isLastSlide ? (
              <>
                Complete <Check className="w-4 h-4" />
              </>
            ) : (
              <>
                Next <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 