import { TRPCProvider } from '@/lib/trpc/trpcClient';
import AssistantAnalytics from '@/components/assistant/AssistantAnalytics';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Assistant Analytics | PersLM',
  description: 'Analytics dashboard for the reasoning assistant usage',
};

export default function AssistantAnalyticsPage() {
  return (
    <TRPCProvider>
      <AssistantAnalytics />
    </TRPCProvider>
  );
} 