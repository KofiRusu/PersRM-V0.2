import React, { useState, useEffect } from 'react';
import { PlusIcon, XIcon, MinusIcon, BarChart3Icon, CheckCircle2Icon, AlertCircleIcon, ClockIcon, TagIcon, FilterIcon } from 'lucide-react';
import { TaskMonitor } from './TaskMonitor';
import { useTaskMonitor } from './TaskMonitorProvider';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Input } from './ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from './ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { toast } from './ui/use-toast';

interface PersLMTaskMonitorProps {
  defaultTasks?: Array<{ description: string, status?: 'pending' | 'in-progress' | 'completed' | 'failed', tags?: string[] }>;
}

export function PersLMTaskMonitor({ defaultTasks }: PersLMTaskMonitorProps) {
  const { 
    tasks, 
    addTask, 
    updateTaskStatus, 
    removeTask, 
    clearTasks,
    completedCount,
    pendingCount,
    inProgressCount,
    completionPercentage 
  } = useTaskMonitor();
  
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Add default tasks if they don't exist already
  useEffect(() => {
    if (defaultTasks && defaultTasks.length > 0 && tasks.length === 0) {
      defaultTasks.forEach(task => {
        addTask(task.description, task.tags || []);
        if (task.status && task.status !== 'pending') {
          // We need to wait for the task to be added first
          setTimeout(() => {
            const addedTask = tasks.find(t => t.description === task.description);
            if (addedTask) {
              updateTaskStatus(addedTask.id, task.status || 'pending');
            }
          }, 100);
        }
      });
    }
  }, [defaultTasks, tasks.length, addTask]);

  const handleAddTask = () => {
    if (newTaskDescription.trim()) {
      addTask(newTaskDescription.trim());
      setNewTaskDescription('');
      toast({
        title: "Task added",
        description: `"${newTaskDescription.trim()}" has been added to your tasks`,
      });
    }
  };

  const handleBatchStatusChange = (status: 'pending' | 'in-progress' | 'completed' | 'failed') => {
    if (selectedTaskIds.length === 0) return;
    
    selectedTaskIds.forEach(id => {
      updateTaskStatus(id, status);
    });
    
    toast({
      title: "Tasks updated",
      description: `${selectedTaskIds.length} tasks marked as ${status}`,
    });
    
    // Clear selection after batch operation
    setSelectedTaskIds([]);
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.length === filteredTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map(task => task.id));
    }
  };

  const isTaskSelected = (taskId: string) => {
    return selectedTaskIds.includes(taskId);
  };

  const toggleTaskSelection = (taskId: string) => {
    if (isTaskSelected(taskId)) {
      setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
    } else {
      setSelectedTaskIds(prev => [...prev, taskId]);
    }
  };

  // Filtering and search functionality
  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesSearch = task.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Task statistics
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const averageCompletionTime = (() => {
    const completedTasksWithTime = tasks.filter(t => 
      t.status === 'completed' && t.startTime && t.completionTime
    );
    
    if (completedTasksWithTime.length === 0) return null;
    
    const totalTime = completedTasksWithTime.reduce((sum, task) => {
      const start = new Date(task.startTime!).getTime();
      const end = new Date(task.completionTime!).getTime();
      return sum + (end - start);
    }, 0);
    
    return totalTime / completedTasksWithTime.length;
  })();

  // Mini floating indicator for desktop
  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button 
              className="rounded-full h-16 w-16 shadow-lg flex items-center justify-center relative"
              variant="default"
            >
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                {tasks.filter(t => t.status !== 'completed').length}
              </div>
              <span className="font-mono font-bold">PersLM</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>PersLM Task Monitor</SheetTitle>
            </SheetHeader>
            
            <Tabs defaultValue="tasks" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="stats">Statistics</TabsTrigger>
              </TabsList>
              
              <TabsContent value="tasks" className="space-y-4 mt-4">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon">
                        <FilterIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60">
                      <div className="space-y-2">
                        <h4 className="font-medium">Filter by Status</h4>
                        <div className="flex flex-col gap-2">
                          <Button 
                            variant={filterStatus === 'all' ? "default" : "outline"} 
                            size="sm" 
                            onClick={() => setFilterStatus('all')}
                            className="justify-start"
                          >
                            All
                          </Button>
                          <Button 
                            variant={filterStatus === 'pending' ? "default" : "outline"} 
                            size="sm" 
                            onClick={() => setFilterStatus('pending')}
                            className="justify-start"
                          >
                            Pending
                          </Button>
                          <Button 
                            variant={filterStatus === 'in-progress' ? "default" : "outline"} 
                            size="sm" 
                            onClick={() => setFilterStatus('in-progress')}
                            className="justify-start"
                          >
                            In Progress
                          </Button>
                          <Button 
                            variant={filterStatus === 'completed' ? "default" : "outline"} 
                            size="sm" 
                            onClick={() => setFilterStatus('completed')}
                            className="justify-start"
                          >
                            Completed
                          </Button>
                          <Button 
                            variant={filterStatus === 'failed' ? "default" : "outline"} 
                            size="sm" 
                            onClick={() => setFilterStatus('failed')}
                            className="justify-start"
                          >
                            Failed
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                
                {selectedTaskIds.length > 0 && (
                  <div className="bg-muted p-2 rounded-md flex items-center justify-between">
                    <span className="text-sm">{selectedTaskIds.length} selected</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => handleBatchStatusChange('pending')}>
                        Mark Pending
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleBatchStatusChange('in-progress')}>
                        Start
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleBatchStatusChange('completed')}>
                        Complete
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="select-all" 
                      checked={selectedTaskIds.length > 0 && selectedTaskIds.length === filteredTasks.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <label htmlFor="select-all" className="text-sm cursor-pointer">
                      {selectedTaskIds.length > 0 && selectedTaskIds.length === filteredTasks.length 
                        ? "Deselect all" 
                        : "Select all"}
                    </label>
                  </div>
                  <Badge variant="outline">
                    {filteredTasks.length} task{filteredTasks.length !== 1 && 's'}
                  </Badge>
                </div>
                
                <TaskMonitor 
                  projectName="PersLM" 
                  tasks={filteredTasks} 
                  onTaskStatusChange={updateTaskStatus}
                  selectedTaskIds={selectedTaskIds}
                  onTaskSelect={toggleTaskSelection}
                />
                
                <div className="flex items-center gap-2 mt-4">
                  <Input
                    placeholder="Add new task..."
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                    className="flex-1"
                  />
                  <Button onClick={handleAddTask} size="sm">
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="stats" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Task Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">Overall Progress</span>
                        <span className="text-sm font-medium">{Math.round(completionPercentage)}%</span>
                      </div>
                      <Progress value={completionPercentage} className="h-2" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted p-3 rounded-md">
                        <div className="text-2xl font-bold">{completedCount}</div>
                        <div className="text-xs text-muted-foreground">Completed</div>
                      </div>
                      <div className="bg-muted p-3 rounded-md">
                        <div className="text-2xl font-bold">{inProgressCount}</div>
                        <div className="text-xs text-muted-foreground">In Progress</div>
                      </div>
                      <div className="bg-muted p-3 rounded-md">
                        <div className="text-2xl font-bold">{pendingCount}</div>
                        <div className="text-xs text-muted-foreground">Pending</div>
                      </div>
                      <div className="bg-muted p-3 rounded-md">
                        <div className="text-2xl font-bold">{failedCount}</div>
                        <div className="text-xs text-muted-foreground">Failed</div>
                      </div>
                    </div>
                    
                    {averageCompletionTime && (
                      <div className="bg-muted p-3 rounded-md">
                        <div className="text-sm font-medium mb-1">Average Completion Time</div>
                        <div className="text-lg font-bold">
                          {Math.round(averageCompletionTime / (1000 * 60))} minutes
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            
            <SheetFooter className="mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearTasks}
              >
                Clear All
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Full view for expanded mode
  return (
    <Card className="m-4">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle>PersLM Task Monitor</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
          <MinusIcon className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <TaskMonitor 
          projectName="PersLM" 
          tasks={tasks} 
          onTaskStatusChange={updateTaskStatus}
          selectedTaskIds={selectedTaskIds}
          onTaskSelect={toggleTaskSelection}
        />
        
        <div className="flex items-center gap-2 mt-4">
          <Input
            placeholder="Add new task..."
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            className="flex-1"
          />
          <Button onClick={handleAddTask} size="sm">
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex justify-end mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearTasks}
          >
            Clear All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 