import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, AlertCircle, Clock, TagIcon, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { toast } from './ui/use-toast';

interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startTime?: Date;
  completionTime?: Date;
  tags?: string[];
  details?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

interface TaskMonitorProps {
  projectName: string;
  tasks: Task[];
  onTaskStatusChange?: (taskId: string, newStatus: Task['status']) => void;
  onTaskDetailsChange?: (taskId: string, details: string) => void;
  onTaskTagsChange?: (taskId: string, tags: string[]) => void;
  onTaskPriorityChange?: (taskId: string, priority: Task['priority']) => void;
  selectedTaskIds?: string[];
  onTaskSelect?: (taskId: string) => void;
}

export function TaskMonitor({
  projectName,
  tasks,
  onTaskStatusChange,
  onTaskDetailsChange,
  onTaskTagsChange,
  onTaskPriorityChange,
  selectedTaskIds = [],
  onTaskSelect
}: TaskMonitorProps) {
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskDetails, setTaskDetails] = useState('');
  const [taskTags, setTaskTags] = useState('');
  const [taskPriority, setTaskPriority] = useState<Task['priority']>('medium');

  useEffect(() => {
    // Calculate completion percentage
    if (tasks.length === 0) return;
    
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    setCompletionPercentage((completedTasks / tasks.length) * 100);
  }, [tasks]);

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-300" />;
    }
  };

  const getPriorityColor = (priority?: Task['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusToggle = (taskId: string) => {
    if (!onTaskStatusChange) return;
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    let newStatus: Task['status'] = 'pending';
    
    switch (task.status) {
      case 'pending':
        newStatus = 'in-progress';
        break;
      case 'in-progress':
        newStatus = 'completed';
        break;
      case 'completed':
        newStatus = 'failed';
        break;
      case 'failed':
        newStatus = 'pending';
        break;
    }
    
    onTaskStatusChange(taskId, newStatus);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskDetails(task.details || '');
    setTaskTags(task.tags?.join(', ') || '');
    setTaskPriority(task.priority || 'medium');
  };

  const handleSaveEdit = () => {
    if (!editingTask) return;
    
    if (onTaskDetailsChange) {
      onTaskDetailsChange(editingTask.id, taskDetails);
    }
    
    if (onTaskTagsChange) {
      const tags = taskTags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      onTaskTagsChange(editingTask.id, tags);
    }
    
    if (onTaskPriorityChange) {
      onTaskPriorityChange(editingTask.id, taskPriority);
    }
    
    setEditingTask(null);
    toast({
      title: "Task updated",
      description: "The task has been updated successfully"
    });
  };

  const formatDate = (date?: Date) => {
    if (!date) return '';
    
    const now = new Date();
    const taskDate = new Date(date);
    
    // If today, just show time
    if (taskDate.toDateString() === now.toDateString()) {
      return `Today at ${taskDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // If yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (taskDate.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${taskDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Otherwise show date and time
    return taskDate.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{projectName} Task Monitor</span>
          <span className="text-sm font-normal text-gray-500">
            {tasks.filter(t => t.status === 'completed').length} of {tasks.length} completed
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={completionPercentage} className="mb-4" />
        
        <div className="space-y-2">
          {tasks.map(task => (
            <div 
              key={task.id} 
              className={`flex items-center justify-between p-2 hover:bg-gray-50 rounded-md transition-colors ${
                selectedTaskIds?.includes(task.id) ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {onTaskSelect && (
                  <Checkbox 
                    checked={selectedTaskIds.includes(task.id)} 
                    onCheckedChange={() => onTaskSelect(task.id)}
                    className="mr-1"
                  />
                )}
                <button 
                  onClick={() => handleStatusToggle(task.id)}
                  className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full flex-shrink-0"
                >
                  {getStatusIcon(task.status)}
                </button>
                <div className="flex flex-col min-w-0">
                  <span className={task.status === 'completed' ? 'line-through text-gray-500 truncate' : 'truncate'}>
                    {task.description}
                  </span>
                  
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    {task.priority && (
                      <Badge variant="outline" className={`${getPriorityColor(task.priority)} mr-1 text-xs px-1.5 py-0`}>
                        {task.priority}
                      </Badge>
                    )}
                    
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {task.tags.slice(0, 2).map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                        
                        {task.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            +{task.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500 text-right">
                  {task.status === 'completed' && task.completionTime && 
                    formatDate(task.completionTime)}
                  {task.status === 'in-progress' && task.startTime &&
                    formatDate(task.startTime)}
                </div>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={() => handleEditTask(task)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Task</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                      <div className="flex flex-col gap-2">
                        <h4 className="text-sm font-medium">Description</h4>
                        <p className="text-sm">{task.description}</p>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <h4 className="text-sm font-medium">Status</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">{task.status}</span>
                          {getStatusIcon(task.status)}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <h4 className="text-sm font-medium">Priority</h4>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant={taskPriority === 'low' ? "default" : "outline"}
                            onClick={() => setTaskPriority('low')}
                            className="flex-1"
                          >
                            Low
                          </Button>
                          <Button 
                            size="sm" 
                            variant={taskPriority === 'medium' ? "default" : "outline"}
                            onClick={() => setTaskPriority('medium')}
                            className="flex-1"
                          >
                            Medium
                          </Button>
                          <Button 
                            size="sm" 
                            variant={taskPriority === 'high' ? "default" : "outline"}
                            onClick={() => setTaskPriority('high')}
                            className="flex-1"
                          >
                            High
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <h4 className="text-sm font-medium">Details</h4>
                        <Textarea 
                          placeholder="Add task details..."
                          value={taskDetails}
                          onChange={(e) => setTaskDetails(e.target.value)}
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <h4 className="text-sm font-medium">Tags (comma separated)</h4>
                        <Input 
                          placeholder="feature, ui, bugfix..."
                          value={taskTags}
                          onChange={(e) => setTaskTags(e.target.value)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Created</p>
                          <p className="text-gray-500">{formatDate(task.createdAt)}</p>
                        </div>
                        <div>
                          <p className="font-medium">Updated</p>
                          <p className="text-gray-500">{formatDate(task.updatedAt)}</p>
                        </div>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditingTask(null)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveEdit}>
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 