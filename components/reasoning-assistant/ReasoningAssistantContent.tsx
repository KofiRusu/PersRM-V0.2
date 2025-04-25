import React from 'react';
import ReasoningAssistantTab from './ReasoningAssistantTab';
import { useReasoningAssistant } from './ReasoningAssistantProvider';
import { cn } from '@/lib/utils';
import { X, Brain } from 'lucide-react';
import { Button } from '@/components/ui';

interface ReasoningAssistantContentProps {
  className?: string;
}

const ReasoningAssistantContent: React.FC<ReasoningAssistantContentProps> = ({ className }) => {
  const { closeAssistant } = useReasoningAssistant();
  
  const handleClose = () => {
    closeAssistant('button');
  };
  
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-2 mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">Reasoning Assistant</h2>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleClose}
          aria-label="Close reasoning assistant"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <ReasoningAssistantTab />
      </div>
    </div>
  );
};

export default ReasoningAssistantContent; 