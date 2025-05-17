import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, BarChart2, Activity, Users, MessageSquare } from 'lucide-react';
import { OnboardingModal } from '@/components/OnboardingModal';
import { useOnboarding } from '@/hooks/useOnboarding';
import { FeedbackModal } from '@/components/FeedbackModal';
import { FeedbackButton } from '@/components/FeedbackButton';
import { useFeedbackModal } from '@/hooks/useFeedbackModal';
import MainPage from "@/components/task-monitor/MainPage";

export const metadata: Metadata = {
  title: 'Dashboard | PersLM',
  description: 'Analytics dashboard for PersLM',
};

export default function DashboardPage() {
  return <MainPage />;
}

'use client';

// This is a client component that can use hooks
function DashboardContent() {
  const { isOnboardingOpen, completeOnboarding, closeOnboarding } = useOnboarding();
  const { isOpen: isFeedbackOpen, openModal: openFeedback, closeModal: closeFeedback } = useFeedbackModal();
  
  // When onboarding completes, we'll open the feedback modal
  const handleOnboardingComplete = () => {
    completeOnboarding();
    // Short delay before showing feedback modal
    setTimeout(() => {
      openFeedback();
    }, 500);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Analytics and insights for PersLM
            </p>
          </div>
          <FeedbackButton onClick={openFeedback} />
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Assistant Analytics
              </CardTitle>
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                View usage analytics for the reasoning assistant
              </div>
              <div className="mt-4">
                <Link href="/dashboard/assistant-analytics">
                  <Button variant="outline" size="sm" className="gap-1">
                    View Analytics <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Model Benchmarks
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                Compare performance between different AI models
              </div>
              <div className="mt-4">
                <Link href="/dashboard/benchmark">
                  <Button variant="outline" size="sm" className="gap-1">
                    View Benchmarks <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                User Analytics
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                View user engagement and satisfaction metrics
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm" className="gap-1" disabled>
                  Coming Soon <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* New Card for Admin Feedback Dashboard */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Beta Feedback
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                Review and analyze feedback submitted by beta testers
              </div>
              <div className="mt-4">
                <Link href="/admin/feedback">
                  <Button variant="outline" size="sm" className="gap-1">
                    View Feedback <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating feedback button for mobile */}
      <div className="md:hidden">
        <FeedbackButton onClick={openFeedback} variant="floating" />
      </div>

      {/* Onboarding Modal */}
      <OnboardingModal 
        isOpen={isOnboardingOpen} 
        onComplete={handleOnboardingComplete} 
        onClose={closeOnboarding} 
      />

      {/* Feedback Modal */}
      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={closeFeedback} 
        userId="current-user-id" // Replace with actual user ID when auth is implemented
      />
    </>
  );
} 