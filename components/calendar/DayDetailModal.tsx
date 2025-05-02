'use client';

import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { X, CalendarRange, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskPill } from './TaskPill';

interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  tasks: Array<{
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
  }>;
}

export function DayDetailModal({ isOpen, onClose, date, tasks }: DayDetailModalProps) {
  const router = useRouter();
  
  const handleAddTask = () => {
    // Navigate to task creation with the selected date pre-filled
    const formattedDate = format(date, 'yyyy-MM-dd');
    router.push(`/tasks/new?dueDate=${formattedDate}`);
  };
  
  const handleTaskClick = (taskId: string) => {
    router.push(`/tasks/${taskId}`);
  };
  
  const groupTasksByStatus = () => {
    const grouped: Record<string, any[]> = {
      PENDING: [],
      'IN_PROGRESS': [],
      COMPLETED: [],
      BACKLOG: [],
      OTHER: []
    };
    
    tasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      } else {
        grouped.OTHER.push(task);
      }
    });
    
    // Filter out empty groups
    return Object.entries(grouped)
      .filter(([_, tasks]) => tasks.length > 0)
      .sort(([statusA], [statusB]) => {
        // Custom sort order
        const order = { PENDING: 0, 'IN_PROGRESS': 1, BACKLOG: 2, COMPLETED: 3, OTHER: 4 };
        return order[statusA as keyof typeof order] - order[statusB as keyof typeof order];
      });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex flex-col space-y-1">
            <DialogTitle className="text-xl flex items-center gap-2">
              <CalendarRange className="h-5 w-5" />
              {format(date, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} due
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handleAddTask}
          >
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          {tasks.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No tasks due on this day</p>
              <Button 
                variant="outline" 
                className="mt-4 gap-1"
                onClick={handleAddTask}
              >
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {groupTasksByStatus().map(([status, statusTasks]) => (
                <div key={status} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{status}</h3>
                  <div className="space-y-2">
                    {statusTasks.map((task) => (
                      <div
                        key={task.id}
                        className="cursor-pointer"
                        onClick={() => handleTaskClick(task.id)}
                      >
                        <TaskPill task={task} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
} 