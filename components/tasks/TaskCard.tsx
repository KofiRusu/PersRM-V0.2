import { RecurrenceIndicator } from './RecurrenceIndicator';

export function TaskCard({ task, onStatusChange }: TaskCardProps) {
  return (
    <div className="border rounded-lg p-4 mb-4 bg-card">
      <div className="flex flex-wrap items-center gap-2 mt-2">
        {task.recurrence && (
          <RecurrenceIndicator
            recurrence={task.recurrence}
            size="sm"
          />
        )}
      </div>
    </div>
  );
} 