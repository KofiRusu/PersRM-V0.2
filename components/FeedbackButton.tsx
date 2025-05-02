import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui';

interface FeedbackButtonProps {
  onClick: () => void;
  variant?: 'default' | 'floating';
  className?: string;
}

export function FeedbackButton({ 
  onClick, 
  variant = 'default',
  className = '' 
}: FeedbackButtonProps) {
  if (variant === 'floating') {
    return (
      <button
        onClick={onClick}
        className={`fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 z-10 ${className}`}
        aria-label="Provide Feedback"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    );
  }

  return (
    <Button
      onClick={onClick}
      className={className}
      variant="outline"
    >
      <MessageSquare className="mr-2 h-4 w-4" />
      Provide Feedback
    </Button>
  );
} 