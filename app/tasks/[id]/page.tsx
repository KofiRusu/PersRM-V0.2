import { RecurrenceDialog } from '@/components/tasks/RecurrenceDialog';
import { RecurrenceIndicator } from '@/components/tasks/RecurrenceIndicator';
import { RefreshCw, RefreshCcw } from 'lucide-react';
import { TaskComments } from '@/components/tasks/TaskComments';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { trpc } from '@/app/_trpc/client';

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  // ... existing state and hooks ...
  
  // Add state for recurrence dialog
  const [recurrenceDialogOpen, setRecurrenceDialogOpen] = useState(false);
  
  // Add recurrence query
  const recurrenceQuery = trpc.recurrence.getRecurrenceByTask.useQuery(
    { taskId: params.id },
    {
      enabled: !!params.id,
      onError: (error) => {
        toast({
          title: "Error loading recurrence",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  );
  
  // Add generate next occurrence mutation
  const generateNextOccurrenceMutation = trpc.recurrence.generateNextOccurrence.useMutation({
    onSuccess: (newTask) => {
      toast({
        title: "Next occurrence created",
        description: `A new task "${newTask.title}" has been created`,
      });
      
      // Optional: Navigate to the new task
      // router.push(`/tasks/${newTask.id}`);
    },
    onError: (error) => {
      toast({
        title: "Failed to generate next occurrence",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle generating next occurrence
  const handleGenerateNextOccurrence = () => {
    if (confirm("Generate next occurrence of this task?")) {
      generateNextOccurrenceMutation.mutate({
        taskId: params.id,
        copySubtasks: true,
        copyLabels: true,
      });
    }
  };

  // ... existing code ...

  // Add this to the UI where appropriate (e.g., after status or in a section for recurrence)
  return (
    <div>
      {/* ... existing UI ... */}
      
      {/* Add recurrence section after task status or in the metadata section */}
      <div className="mt-4">
        {/* Task recurrence */}
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Recurrence</div>
          <div className="flex items-center gap-2">
            {recurrenceQuery.data?.recurrence ? (
              <>
                <RecurrenceIndicator 
                  recurrence={recurrenceQuery.data.recurrence}
                  onClick={() => setRecurrenceDialogOpen(true)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={handleGenerateNextOccurrence}
                  disabled={generateNextOccurrenceMutation.isPending}
                >
                  {generateNextOccurrenceMutation.isPending ? (
                    <>
                      <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Generate Next</span>
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => setRecurrenceDialogOpen(true)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Set Recurrence</span>
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Recurrence Dialog */}
      <RecurrenceDialog
        open={recurrenceDialogOpen}
        onOpenChange={setRecurrenceDialogOpen}
        taskId={params.id}
        existingRecurrence={recurrenceQuery.data?.recurrence || null}
      />
      
      {/* Add the Task Comments Component */}
      <div className="mt-8 border-t pt-6">
        <TaskComments taskId={params.id} />
      </div>
      
      {/* ... rest of UI ... */}
    </div>
  );
} 