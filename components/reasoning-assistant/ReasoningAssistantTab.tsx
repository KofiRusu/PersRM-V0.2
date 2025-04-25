import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import ReasoningTreeVisualizer from './ReasoningTreeVisualizer';
import { cn } from '@/lib/utils';

interface ReasoningAssistantTabProps {
  className?: string;
}

const ReasoningAssistantTab: React.FC<ReasoningAssistantTabProps> = ({ className }) => {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      <Tabs defaultValue="visualization" className="w-full h-full flex flex-col">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="visualization">Reasoning</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="visualization" className="flex-1">
          <ReasoningTreeVisualizer />
        </TabsContent>
        <TabsContent value="history" className="flex-1">
          <div className="border rounded-md p-4 h-full">
            <h3 className="text-lg font-medium mb-4">Reasoning History</h3>
            <p className="text-muted-foreground">
              View your past reasoning sessions and their outcomes.
            </p>
            {/* History content will be added in future iterations */}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReasoningAssistantTab; 