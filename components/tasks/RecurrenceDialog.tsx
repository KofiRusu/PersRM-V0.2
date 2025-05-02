'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RecurrenceForm } from './RecurrenceForm';
import { trpc } from '@/lib/client/trpc';
import { toast } from '@/components/ui/use-toast';

type RecurrencePattern = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

interface RecurrenceData {
  pattern: RecurrencePattern;
  interval: number;
  endsAt?: Date | null;
}

interface RecurrenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  existingRecurrence?: {
    id: string;
    pattern: string;
    interval: number;
    endsAt?: Date | null;
  } | null;
  onSuccess?: () => void;
}

export function RecurrenceDialog({
  open,
  onOpenChange,
  taskId,
  existingRecurrence,
  onSuccess
}: RecurrenceDialogProps) {
  const utils = trpc.useUtils();
  
  // Initialize form state with existing recurrence data if available
  const [recurrenceData, setRecurrenceData] = useState<RecurrenceData>(
    existingRecurrence
      ? {
          pattern: existingRecurrence.pattern as RecurrencePattern,
          interval: existingRecurrence.interval,
          endsAt: existingRecurrence.endsAt || null
        }
      : {
          pattern: 'DAILY',
          interval: 1,
          endsAt: null
        }
  );

  // Mutations for creating, updating, and deleting recurrence
  const createRecurrenceMutation = trpc.recurrence.createRecurrence.useMutation({
    onSuccess: () => {
      toast({
        title: 'Recurrence set',
        description: 'Task recurrence has been configured.',
      });
      utils.recurrence.getRecurrenceByTask.invalidate({ taskId });
      utils.tasks.getTaskById.invalidate({ id: taskId });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: 'Failed to set recurrence',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const updateRecurrenceMutation = trpc.recurrence.updateRecurrence.useMutation({
    onSuccess: () => {
      toast({
        title: 'Recurrence updated',
        description: 'Task recurrence has been updated.',
      });
      utils.recurrence.getRecurrenceByTask.invalidate({ taskId });
      utils.tasks.getTaskById.invalidate({ id: taskId });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: 'Failed to update recurrence',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const deleteRecurrenceMutation = trpc.recurrence.deleteRecurrence.useMutation({
    onSuccess: () => {
      toast({
        title: 'Recurrence removed',
        description: 'Task recurrence has been removed.',
      });
      utils.recurrence.getRecurrenceByTask.invalidate({ taskId });
      utils.tasks.getTaskById.invalidate({ id: taskId });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: 'Failed to remove recurrence',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Handle form submission
  const handleSubmit = () => {
    if (existingRecurrence) {
      // Update existing recurrence
      updateRecurrenceMutation.mutate({
        id: existingRecurrence.id,
        pattern: recurrenceData.pattern,
        interval: recurrenceData.interval,
        endsAt: recurrenceData.endsAt
      });
    } else {
      // Create new recurrence
      createRecurrenceMutation.mutate({
        taskId,
        pattern: recurrenceData.pattern,
        interval: recurrenceData.interval,
        endsAt: recurrenceData.endsAt
      });
    }
  };

  // Handle recurrence removal
  const handleRemoveRecurrence = () => {
    if (existingRecurrence) {
      if (confirm('Are you sure you want to remove this recurrence?')) {
        deleteRecurrenceMutation.mutate({ id: existingRecurrence.id });
      }
    } else {
      // If no existing recurrence, just close the dialog
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {existingRecurrence ? 'Edit Recurrence' : 'Set Task Recurrence'}
          </DialogTitle>
          <DialogDescription>
            Configure how often this task should repeat.
          </DialogDescription>
        </DialogHeader>

        <RecurrenceForm 
          value={recurrenceData} 
          onChange={setRecurrenceData} 
          className="py-4"
        />

        <DialogFooter className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handleRemoveRecurrence}
            type="button"
          >
            {existingRecurrence ? 'Remove Recurrence' : 'Cancel'}
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={
              createRecurrenceMutation.isPending || 
              updateRecurrenceMutation.isPending
            }
          >
            {(createRecurrenceMutation.isPending || updateRecurrenceMutation.isPending) 
              ? 'Saving...' 
              : existingRecurrence 
                ? 'Update' 
                : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 