import { shouldGenerateRecurrence } from '@/lib/utils/recurrence';

export function StatusSelector({ task, disabled }: StatusSelectorProps) {
  // ... existing state and hooks ...
  
  // Add mutation for generating next occurrence
  const generateNextOccurrenceMutation = trpc.recurrence.generateNextOccurrence.useMutation({
    onSuccess: (newTask) => {
      toast({
        title: "Next occurrence created",
        description: `A new task "${newTask.title}" has been created.`,
      });
    },
    onError: (error) => {
      console.error('Failed to generate next occurrence:', error);
      // Optionally show error toast
    }
  });
  
  // Update the status change handler
  const handleStatusChange = (newStatus: string) => {
    updateTaskMutation.mutate(
      { id: task.id, status: newStatus },
      {
        onSuccess: (updatedTask) => {
          // Check if this is a recurring task that was just completed
          if (
            newStatus === 'COMPLETED' && 
            updatedTask.recurrence && 
            shouldGenerateRecurrence(updatedTask)
          ) {
            // Generate the next occurrence
            generateNextOccurrenceMutation.mutate({
              taskId: task.id,
              copySubtasks: true,
              copyLabels: true,
            });
          }
        }
      }
    );
  };
  
  // ... existing code ...
} 