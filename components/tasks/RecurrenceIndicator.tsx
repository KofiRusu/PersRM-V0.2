'use client';

import { RefreshCw } from 'lucide-react';
import { formatRecurrencePattern } from '@/lib/utils/recurrence';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface RecurrenceIndicatorProps {
  recurrence: {
    id: string;
    pattern: string;
    interval: number;
    endsAt?: Date | null;
  };
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

export function RecurrenceIndicator({ 
  recurrence, 
  size = 'md', 
  onClick,
  className
}: RecurrenceIndicatorProps) {
  const formattedPattern = formatRecurrencePattern(recurrence.pattern, recurrence.interval);
  
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={size === 'sm' ? 'sm' : 'default'}
            className={cn(
              "h-auto py-1 px-2 flex items-center gap-1.5",
              sizeClasses[size],
              "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
              onClick ? "cursor-pointer" : "cursor-default",
              className
            )}
            onClick={onClick}
          >
            <RefreshCw className={cn(
              "text-gray-500 dark:text-gray-400",
              size === 'sm' ? "h-3 w-3" : size === 'md' ? "h-4 w-4" : "h-5 w-5"
            )} />
            <span>{formattedPattern}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">
              {formattedPattern}
            </p>
            {recurrence.endsAt && (
              <p className="text-xs">
                Ends on {format(new Date(recurrence.endsAt), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 