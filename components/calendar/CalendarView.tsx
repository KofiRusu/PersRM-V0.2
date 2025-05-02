'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, 
         isSameDay, addMonths, subMonths, parseISO, isToday, startOfWeek, endOfWeek, 
         getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskPill } from './TaskPill';
import { trpc } from '@/lib/client/trpc';
import { cn } from '@/lib/utils';
import { DayDetailModal } from './DayDetailModal';

interface CalendarViewProps {
  view: 'month' | 'week';
}

export function CalendarView({ view }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayTasks, setSelectedDayTasks] = useState<any[]>([]);
  
  // Create a first day of month and last day of month for the currently selected month
  const firstDayOfMonth = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const lastDayOfMonth = useMemo(() => endOfMonth(currentDate), [currentDate]);
  
  // Get the first day of the calendar grid (might be in previous month)
  const startDate = useMemo(() => {
    const firstDay = startOfWeek(firstDayOfMonth, { weekStartsOn: 0 });
    return firstDay;
  }, [firstDayOfMonth]);
  
  // Get the last day of the calendar grid (might be in next month)
  const endDate = useMemo(() => {
    const lastDay = endOfWeek(lastDayOfMonth, { weekStartsOn: 0 });
    return lastDay;
  }, [lastDayOfMonth]);
  
  // Get all days for the calendar grid
  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);
  
  // Fetch tasks for the current month
  const { data: tasks, isLoading } = trpc.tasks.getTasks.useQuery({
    startDate: startDate,
    endDate: endDate,
  }, {
    enabled: !!startDate && !!endDate,
  });
  
  // Group tasks by date
  const tasksByDate = useMemo(() => {
    if (!tasks) return new Map();
    
    const taskMap = new Map<string, any[]>();
    
    tasks.forEach(task => {
      if (task.dueDate) {
        const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd');
        
        if (!taskMap.has(dateKey)) {
          taskMap.set(dateKey, []);
        }
        
        taskMap.get(dateKey)!.push(task);
      }
    });
    
    return taskMap;
  }, [tasks]);
  
  // Navigation handlers
  const goToPreviousMonth = () => {
    setCurrentDate(prevDate => subMonths(prevDate, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentDate(prevDate => addMonths(prevDate, 1));
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  // Add a handler for day cell click
  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    // Get tasks for the selected day
    const dateKey = format(day, 'yyyy-MM-dd');
    setSelectedDayTasks(tasksByDate.get(dateKey) || []);
  };
  
  // Close modal handler
  const handleCloseModal = () => {
    setSelectedDate(null);
  };
  
  // Renders the month view calendar
  const renderMonthView = () => {
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return (
      <div className="bg-card border rounded-lg overflow-hidden">
        {/* Calendar header with days of week */}
        <div className="grid grid-cols-7 border-b text-center">
          {weekDays.map((day, index) => (
            <div key={index} className="py-2 font-medium text-sm text-muted-foreground">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7 h-[700px] sm:h-[600px]">
          {calendarDays.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDate.get(dateKey) || [];
            const isDayInCurrentMonth = isSameMonth(day, currentDate);
            
            return (
              <div
                key={index}
                className={cn(
                  "min-h-[100px] border-b border-r p-1 relative",
                  !isDayInCurrentMonth && "bg-muted/50",
                  isToday(day) && "bg-primary/5",
                  "cursor-pointer hover:bg-muted/30 transition-colors"
                )}
                onClick={() => handleDayClick(day)}
              >
                {/* Day number */}
                <div className={cn(
                  "font-medium h-7 w-7 flex items-center justify-center text-sm rounded-full",
                  isToday(day) && "bg-primary text-primary-foreground",
                  !isDayInCurrentMonth && "text-muted-foreground"
                )}>
                  {format(day, 'd')}
                </div>
                
                {/* Task pills */}
                <div className="space-y-1 mt-1 max-h-[calc(100%-28px)] overflow-y-auto">
                  {dayTasks.slice(0, 4).map(task => (
                    <TaskPill 
                      key={task.id} 
                      task={task} 
                    />
                  ))}
                  
                  {/* Show more indicator if there are more than 4 tasks */}
                  {dayTasks.length > 4 && (
                    <div className="text-xs px-2 py-1 bg-muted rounded text-center">
                      + {dayTasks.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Render week view (placeholder for now)
  const renderWeekView = () => {
    return (
      <div className="bg-card border rounded-lg h-[600px] flex items-center justify-center">
        <div className="text-muted-foreground">
          Week view coming soon...
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      {/* Calendar navigation */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousMonth}
            title="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            title="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="ml-2"
          >
            Today
          </Button>
        </div>
        
        <h2 className="text-xl font-semibold">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        
        <div className="w-[100px] flex justify-end">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </div>
      </div>
      
      {/* Calendar content */}
      <div className="pb-4 px-2">
        {view === 'month' ? renderMonthView() : renderWeekView()}
      </div>
      
      {/* Day detail modal */}
      {selectedDate && (
        <DayDetailModal
          isOpen={!!selectedDate}
          onClose={handleCloseModal}
          date={selectedDate}
          tasks={selectedDayTasks}
        />
      )}
    </div>
  );
} 