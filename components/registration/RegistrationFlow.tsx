import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/router"; // Assuming Next.js usage
import { EmailPasswordForm } from "./EmailPasswordForm";
import { ProfileSetupForm } from "./ProfileSetupForm";
import { RoleSelectionForm } from "./RoleSelectionForm";
import { RegistrationReview } from "./RegistrationReview";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";

// Type definition for the user registration data
interface UserRegistrationData {
  // Step 1: Email & Password
  email: string;
  password: string;
  
  // Step 2: Profile
  firstName: string;
  lastName: string;
  timezone: string;
  bio?: string;
  avatarUrl?: string;
  
  // Step 3: Role
  role: "admin" | "user" | "guest";
  
  // Step 4: Terms
  termsAccepted: boolean;
  marketingOptIn: boolean;
}

// Registration flow component props
interface RegistrationFlowProps {
  onRegistrationComplete?: (userData: UserRegistrationData) => void;
  defaultValues?: Partial<UserRegistrationData>;
}

export function RegistrationFlow({
  onRegistrationComplete,
  defaultValues = {},
}: RegistrationFlowProps) {
  // State for current step
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Router for navigation after completion
  const router = useRouter();
  
  // Toast notifications
  const { toast } = useToast();
  
  // State for user registration data
  const [userData, setUserData] = useState<Partial<UserRegistrationData>>(defaultValues);
  
  // Steps information
  const steps = [
    { title: "Account", description: "Create your account" },
    { title: "Profile", description: "Tell us about yourself" },
    { title: "Role", description: "Select your access level" },
    { title: "Review", description: "Confirm your details" },
  ];
  
  // Calculate progress percentage
  const progressPercentage = ((currentStep + 1) / steps.length) * 100;
  
  // Handle next step
  const handleNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    window.scrollTo(0, 0);
  }, [steps.length]);
  
  // Handle previous step
  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo(0, 0);
  }, []);
  
  // Handle going to a specific step (for editing)
  const handleGoToStep = useCallback((step: number) => {
    setCurrentStep(step);
    window.scrollTo(0, 0);
  }, []);
  
  // Handle completion of step 1 (Email & Password)
  const handleEmailPasswordComplete = useCallback((data: { email: string; password: string }) => {
    setUserData((prev) => ({ ...prev, ...data }));
    handleNext();
  }, [handleNext]);
  
  // Handle completion of step 2 (Profile)
  const handleProfileComplete = useCallback((data: {
    firstName: string;
    lastName: string;
    timezone: string;
    bio?: string;
    avatarUrl?: string;
  }) => {
    setUserData((prev) => ({ ...prev, ...data }));
    handleNext();
  }, [handleNext]);
  
  // Handle completion of step 3 (Role)
  const handleRoleComplete = useCallback((data: { role: "admin" | "user" | "guest" }) => {
    setUserData((prev) => ({ ...prev, ...data }));
    handleNext();
  }, [handleNext]);
  
  // Handle completion of step 4 (Review)
  const handleRegistrationComplete = useCallback(async (data: { 
    termsAccepted: boolean; 
    marketingOptIn: boolean 
  }) => {
    // Update user data with final terms acceptance
    const finalUserData = {
      ...userData,
      ...data,
    } as UserRegistrationData;
    
    // Show loading state
    setIsLoading(true);
    
    try {
      // In a real app, this would be an API call to register the user
      console.log("Registering user:", finalUserData);
      
      // Simulate API call with delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Call the completion callback if provided
      if (onRegistrationComplete) {
        onRegistrationComplete(finalUserData);
      }
      
      // Show success toast
      toast({
        title: "Registration successful!",
        description: "Your account has been created.",
        variant: "default",
      });
      
      // Redirect to login or dashboard
      // router.push("/login");
      
    } catch (error) {
      // Show error toast
      toast({
        title: "Registration failed",
        description: "An error occurred while creating your account. Please try again.",
        variant: "destructive",
      });
      console.error("Registration error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userData, onRegistrationComplete, toast]);
  
  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <EmailPasswordForm
            onNext={handleEmailPasswordComplete}
            defaultValues={{
              email: userData.email,
              password: userData.password,
            }}
            isLoading={isLoading}
          />
        );
      case 1:
        return (
          <ProfileSetupForm
            onNext={handleProfileComplete}
            onBack={handleBack}
            defaultValues={{
              firstName: userData.firstName,
              lastName: userData.lastName,
              timezone: userData.timezone,
              bio: userData.bio,
              avatarUrl: userData.avatarUrl,
            }}
            isLoading={isLoading}
          />
        );
      case 2:
        return (
          <RoleSelectionForm
            onNext={handleRoleComplete}
            onBack={handleBack}
            defaultValues={{
              role: userData.role,
            }}
            isLoading={isLoading}
          />
        );
      case 3:
        return (
          <RegistrationReview
            userData={userData as UserRegistrationData}
            onComplete={handleRegistrationComplete}
            onBack={handleBack}
            onEdit={handleGoToStep}
            isLoading={isLoading}
          />
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 bg-muted/20">
      <div className="w-full max-w-md space-y-8">
        {/* Progress bar and step indicator */}
        <div className="px-4 sm:px-0">
          <div className="relative">
            <Progress value={progressPercentage} className="h-2" />
            <div className="absolute inset-0 flex justify-between">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-5 h-5 rounded-full -mt-1.5 flex items-center justify-center
                    ${
                      index <= currentStep
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }
                  `}
                  aria-current={index === currentStep ? "step" : undefined}
                >
                  <span className="text-xs font-semibold">{index + 1}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-4 flex justify-between">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`w-1/4 text-center text-xs sm:text-sm ${
                  index <= currentStep
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <span className="hidden sm:block">{step.title}</span>
                <span className="block sm:hidden">
                  {index === currentStep ? step.title : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form content */}
        <div className="w-full bg-background rounded-lg shadow-lg overflow-hidden">
          {renderStep()}
        </div>
      </div>
    </div>
  );
} 