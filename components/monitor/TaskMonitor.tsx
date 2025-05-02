import { useTaskActivity } from '@/lib/hooks/useTaskActivity';
import { ActivityItem, Task as TaskType, ActiveUser } from '@/lib/types/activity';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatStatusText, getStatusColor } from '@/lib/utils/taskStatusColors';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserPlus, Clock, MessageSquare, RefreshCw, Activity, Eye, Edit, Keyboard } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TaskMonitorProps {
  limit?: number;
  userId?: string;
  className?: string;
}

export function TaskMonitor({ limit = 10, userId, className = '' }: TaskMonitorProps) {
  const [activeTab, setActiveTab] = useState('activity');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const {
    activities,
    activeTasks,
    activeUsers,
    loading,
    error,
    refresh,
    formatActivity,
    formatTimeAgo,
  } = useTaskActivity({
    limit,
    userId,
    autoRefreshInterval: 30000, // 30 seconds
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Task Monitor</CardTitle>
            <CardDescription>
              {activeTab === 'activity'
                ? 'Recent task activity'
                : activeTab === 'active'
                ? 'Currently active tasks'
                : 'Users currently working'}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="activity" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="activity" className="flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" />
              <span>Activity</span>
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>Active Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1">
              <UserPlus className="h-3.5 w-3.5" />
              <span>Users</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="activity" className="mt-0">
            <ScrollArea className="h-[400px] pr-4">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <ActivitySkeleton key={i} />
                ))
              ) : activities.length === 0 ? (
                <EmptyState message="No recent activity" icon={<Activity className="h-12 w-12 text-gray-300" />} />
              ) : (
                activities.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    formatActivity={formatActivity}
                    formatTimeAgo={formatTimeAgo}
                  />
                ))
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="active" className="mt-0">
            <ScrollArea className="h-[400px] pr-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TaskSkeleton key={i} />
                ))
              ) : activeTasks.length === 0 ? (
                <EmptyState message="No active tasks" icon={<Clock className="h-12 w-12 text-gray-300" />} />
              ) : (
                <div className="grid gap-3">
                  {activeTasks.map((task) => (
                    <TaskCard key={task.id} task={task} formatTimeAgo={formatTimeAgo} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="users" className="mt-0">
            <ScrollArea className="h-[400px] pr-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <UserSkeleton key={i} />
                ))
              ) : activeUsers.length === 0 ? (
                <EmptyState message="No active users" icon={<UserPlus className="h-12 w-12 text-gray-300" />} />
              ) : (
                <div className="grid gap-3">
                  {activeUsers.map((user) => (
                    <UserCard key={user.userId} user={user} formatTimeAgo={formatTimeAgo} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ActivityItem({ 
  activity, 
  formatActivity, 
  formatTimeAgo 
}: { 
  activity: ActivityItem; 
  formatActivity: (activity: ActivityItem) => string;
  formatTimeAgo: (date: Date) => string;
}) {
  // Get color based on activity type
  const getActivityTypeColor = (type: string) => {
    switch (type) {
      case 'COMMENT_ADDED':
      case 'COMMENT_DELETED':
        return 'bg-blue-500';
      case 'STATUS_CHANGED':
        return 'bg-purple-500';
      case 'TASK_CREATED':
        return 'bg-green-500';
      case 'TASK_UPDATED':
        return 'bg-yellow-500';
      case 'TASK_DELETED':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get icon based on activity type
  const getActivityTypeIcon = (type: string) => {
    switch (type) {
      case 'COMMENT_ADDED':
      case 'COMMENT_DELETED':
        return <MessageSquare className="h-3.5 w-3.5" />;
      case 'STATUS_CHANGED':
        return <Activity className="h-3.5 w-3.5" />;
      case 'TASK_CREATED':
        return <UserPlus className="h-3.5 w-3.5" />;
      case 'TASK_UPDATED':
        return <Edit className="h-3.5 w-3.5" />;
      default:
        return <Clock className="h-3.5 w-3.5" />;
    }
  };

  const taskStatus = activity.task?.status || 'PENDING';
  const statusColor = getStatusColor(taskStatus);

  return (
    <div className="flex items-start space-x-3 mb-4 group animate-fadeIn">
      <Avatar className="h-8 w-8 mt-0.5">
        <AvatarImage src={activity.user?.image || ""} />
        <AvatarFallback>
          {activity.user?.name?.substring(0, 2) || "??"}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-1">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">{formatActivity(activity)}</p>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className={`p-1 rounded-full ${getActivityTypeColor(activity.type)}`}>
            {getActivityTypeIcon(activity.type)}
          </div>
          <span>{formatTimeAgo(new Date(activity.createdAt))}</span>
          
          {activity.task && (
            <Badge 
              className={`ml-auto ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}
              variant="outline"
            >
              {formatStatusText(taskStatus)}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCard({ 
  task, 
  formatTimeAgo 
}: { 
  task: TaskType;
  formatTimeAgo: (date: Date) => string;
}) {
  const statusColor = getStatusColor(task.status);
  
  return (
    <Link href={`/tasks/${task.id}`} className="block">
      <div className="p-3 border rounded-lg hover:border-gray-400 dark:hover:border-gray-600 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-medium truncate">{task.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge 
                className={`${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}
                variant="outline"
              >
                {formatStatusText(task.status)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Updated {formatTimeAgo(new Date(task.updatedAt))}
              </span>
            </div>
          </div>
          
          {task.user && (
            <Avatar className="h-8 w-8 ml-2">
              <AvatarImage src={task.user.image || ""} />
              <AvatarFallback>
                {task.user.name?.substring(0, 2) || "??"}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </Link>
  );
}

function UserCard({ 
  user, 
  formatTimeAgo 
}: { 
  user: ActiveUser;
  formatTimeAgo: (date: Date) => string;
}) {
  // Get icon based on user action
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'typing':
        return <Keyboard className="h-3.5 w-3.5" />;
      case 'editing':
        return <Edit className="h-3.5 w-3.5" />;
      case 'viewing':
      default:
        return <Eye className="h-3.5 w-3.5" />;
    }
  };
  
  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.userImage || ""} />
          <AvatarFallback>
            {user.userName?.substring(0, 2) || "??"}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <p className="font-medium">{user.userName || "Unknown User"}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {getActionIcon(user.action)}
            <span className="capitalize">{user.action}</span>
            <span>{user.taskTitle}</span>
            <span className="ml-auto">{formatTimeAgo(new Date(user.lastActive))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex items-start space-x-3 mb-4">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
      </div>
    </div>
  );
}

function TaskSkeleton() {
  return (
    <div className="p-3 border rounded-lg mb-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-4/5" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-full ml-2" />
      </div>
    </div>
  );
}

function UserSkeleton() {
  return (
    <div className="p-3 border rounded-lg mb-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-center">
      <div className="mb-4 text-gray-400">{icon}</div>
      <p className="text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
} 