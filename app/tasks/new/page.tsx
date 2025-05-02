import { RecurrenceForm } from '@/components/tasks/RecurrenceForm';
import { RefreshCw } from 'lucide-react';

export default function NewTaskPage() {
  // ... existing state and hooks ...
  
  // Add state for recurrence
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [recurrenceData, setRecurrenceData] = useState<{
    pattern: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
    interval: number;
    endsAt?: Date | null;
  } | null>(null);
  
  // Update task creation to include recurrence
  const createTaskMutation = trpc.tasks.createTask.useMutation({
    onSuccess: async (task) => {
      // If recurrence is set, create it after task creation
      if (recurrenceData) {
        try {
          await createRecurrenceMutation.mutateAsync({
            taskId: task.id,
            pattern: recurrenceData.pattern,
            interval: recurrenceData.interval,
            endsAt: recurrenceData.endsAt
          });
        } catch (error) {
          console.error('Failed to create recurrence:', error);
        }
      }
      
      toast({
        title: 'Task created',
        description: 'Your task has been created successfully.',
      });
      
      router.push(`/tasks/${task.id}`);
    },
    onError: (error) => {
      toast({
        title: 'Failed to create task',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Add recurrence creation mutation
  const createRecurrenceMutation = trpc.recurrence.createRecurrence.useMutation({
    onError: (error) => {
      toast({
        title: 'Failed to set recurrence',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // ... existing code ...
  
  // Update form handling to include recurrence
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createTaskMutation.mutate({
      title,
      description,
      status,
      priority,
      dueDate,
      // Other fields...
    });
  };
  
  // Add recurrence toggle and form to your UI
  return (
    <form onSubmit={handleSubmit}>
      {/* ... existing form fields ... */}
      
      {/* Recurrence toggle */}
      <div className="mt-6">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={showRecurrence ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => setShowRecurrence(!showRecurrence)}
          >
            <RefreshCw className="h-4 w-4" />
            {showRecurrence ? 'Hide Recurrence' : 'Set Recurrence'}
          </Button>
          
          {recurrenceData && (
            <span className="text-sm text-muted-foreground">
              Repeats: {recurrenceData.pattern.toLowerCase()} (every {recurrenceData.interval})
            </span>
          )}
        </div>
        
        {showRecurrence && (
          <div className="mt-4 p-4 border rounded-md bg-muted/40">
            <RecurrenceForm
              value={recurrenceData || undefined}
              onChange={(data) => setRecurrenceData(data)}
            />
          </div>
        )}
      </div>
      
      {/* ... submit button and other UI ... */}
    </form>
  );
} 