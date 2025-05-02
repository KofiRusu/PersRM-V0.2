'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatRecurrencePattern } from '@/lib/utils/recurrence';
import { RefreshCw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TaskPillProps {
  task: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: Date | null;
    recurrence?: {
      id: string;
      pattern: string;
      interval: number;
      endsAt?: Date | null;
    } | null;
  };
}

export function TaskPill({ task }: TaskPillProps) {
  const router = useRouter();
  
  // Priority colors
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'LOW':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    }
  };
  
  // Status styles
  const getStatusStyle = (status: string) => {
    if (status === 'COMPLETED') {
      return 'line-through opacity-70';
    }
    return '';
  };
  
  // Handle task click
  const handleClick = () => {
    router.push(`/tasks/${task.id}`);
  };
  
  // Prepare tooltip content
  const tooltipContent = (
    <div className="space-y-1 max-w-xs">
      <p className="font-semibold text-sm">{task.title}</p>
      <div className="text-xs space-y-1">
        <div>
          <span className="text-muted-foreground">Status: </span>
          <span className="font-medium">{task.status}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Priority: </span>
          <span className="font-medium">{task.priority}</span>
        </div>
        {task.dueDate && (
          <div>
            <span className="text-muted-foreground">Due: </span>
            <span className="font-medium">{format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
          </div>
        )}
        {task.recurrence && (
          <div>
            <span className="text-muted-foreground">Repeats: </span>
            <span className="font-medium">
              {formatRecurrencePattern(task.recurrence.pattern, task.recurrence.interval)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "text-xs px-2 py-1 border rounded cursor-pointer flex items-center gap-1",
              getPriorityColor(task.priority),
              getStatusStyle(task.status)
            )}
            onClick={handleClick}
          >
            {/* Recurrence icon */}
            {task.recurrence && (
              <RefreshCw className="h-3 w-3 flex-shrink-0" />
            )}
            
            {/* Title */}
            <span className="truncate">{task.title}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">{tooltipContent}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 