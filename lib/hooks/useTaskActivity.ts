import { useEffect, useState } from 'react';
import { trpc } from '@/app/_trpc/client';
import { pusherClient, CHANNELS, EVENTS } from '@/lib/pusher';
import { formatDistanceToNow } from 'date-fns';
import { ActivityItem, ActiveUser, Task } from '@/lib/types/activity';

interface UseTaskActivityOptions {
  limit?: number;
  userId?: string;
  taskId?: string;
  types?: string[];
  autoRefreshInterval?: number | null; // in milliseconds
}

export function useTaskActivity({
  limit = 20,
  userId,
  taskId,
  types,
  autoRefreshInterval = 30000, // 30 seconds default
}: UseTaskActivityOptions = {}) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Query for recent activity
  const activityQuery = trpc.monitor.getRecentActivity.useQuery(
    { limit, userId, taskId, types },
    {
      onSuccess: (data) => {
        setActivities(data as ActivityItem[]);
        setLoading(false);
      },
      onError: (err) => {
        setError(err as Error);
        setLoading(false);
      },
      refetchInterval: autoRefreshInterval,
    }
  );

  // Query for active tasks
  const tasksQuery = trpc.monitor.getActiveTasks.useQuery(
    { limit, userId },
    {
      onSuccess: (data) => {
        setActiveTasks(data as Task[]);
      },
      onError: (err) => {
        console.error('Error fetching active tasks:', err);
      },
      refetchInterval: autoRefreshInterval,
    }
  );

  // Query for active users
  const usersQuery = trpc.monitor.getActiveUsers.useQuery(
    undefined,
    {
      onSuccess: (data) => {
        setActiveUsers(data as ActiveUser[]);
      },
      onError: (err) => {
        console.error('Error fetching active users:', err);
      },
      refetchInterval: autoRefreshInterval,
    }
  );

  // Subscribe to Pusher for real-time updates
  useEffect(() => {
    // Subscribe to global activity channel
    const globalChannel = pusherClient.subscribe(CHANNELS.GLOBAL_ACTIVITY);
    // Subscribe to monitor channel
    const monitorChannel = pusherClient.subscribe(CHANNELS.MONITOR);

    // Handle new activity events
    globalChannel.bind(EVENTS.NEW_ACTIVITY, (newActivity: any) => {
      // Update activities
      setActivities((prevActivities) => {
        // Only add if it's not already in the list (avoid duplicates)
        const exists = prevActivities.some((a) => a.id === newActivity.id);
        if (exists) return prevActivities;

        // Add to the beginning of the array
        return [newActivity, ...prevActivities.slice(0, limit - 1)];
      });
    });

    // Handle active task updates
    monitorChannel.bind(EVENTS.ACTIVE_TASK_UPDATE, (updatedTask: Partial<Task> & { taskId: string }) => {
      setActiveTasks((prevTasks) => {
        // Find if the task exists in our current list
        const taskIndex = prevTasks.findIndex((t) => t.id === updatedTask.taskId);

        // If found, update it
        if (taskIndex >= 0) {
          const newTasks = [...prevTasks];
          newTasks[taskIndex] = {
            ...newTasks[taskIndex],
            ...updatedTask,
            id: updatedTask.taskId,
          };
          return newTasks;
        }

        // Otherwise, we might need to refresh the list entirely
        // as this might be a new active task
        tasksQuery.refetch();
        return prevTasks;
      });
    });

    // Handle active user updates
    monitorChannel.bind(EVENTS.ACTIVE_USER_UPDATE, (userData: ActiveUser) => {
      setActiveUsers((prevUsers) => {
        // Find if the user exists in our current list
        const userIndex = prevUsers.findIndex((u) => u.userId === userData.userId);

        // If found, update it
        if (userIndex >= 0) {
          const newUsers = [...prevUsers];
          newUsers[userIndex] = userData;
          return newUsers;
        }

        // Otherwise, add to the beginning
        return [userData, ...prevUsers.slice(0, 9)]; // Keep max 10 users
      });
    });

    // If we have a specific taskId, also subscribe to that task's channels
    if (taskId) {
      const taskCommentsChannel = pusherClient.subscribe(CHANNELS.TASK_COMMENTS(taskId));
      const taskStatusChannel = pusherClient.subscribe(CHANNELS.TASK_STATUS(taskId));

      // Handle new comment
      taskCommentsChannel.bind(EVENTS.NEW_COMMENT, (comment: any) => {
        // We'll let the global activity handler take care of this
        // Just trigger a refetch to be safe
        activityQuery.refetch();
      });

      // Handle status change
      taskStatusChannel.bind(EVENTS.STATUS_CHANGED, (statusData: any) => {
        // We'll let the global activity handler take care of this
        // Just trigger a refetch to be safe
        activityQuery.refetch();
      });

      return () => {
        taskCommentsChannel.unbind_all();
        taskStatusChannel.unbind_all();
        pusherClient.unsubscribe(CHANNELS.TASK_COMMENTS(taskId));
        pusherClient.unsubscribe(CHANNELS.TASK_STATUS(taskId));
        globalChannel.unbind_all();
        monitorChannel.unbind_all();
        pusherClient.unsubscribe(CHANNELS.GLOBAL_ACTIVITY);
        pusherClient.unsubscribe(CHANNELS.MONITOR);
      };
    }

    return () => {
      globalChannel.unbind_all();
      monitorChannel.unbind_all();
      pusherClient.unsubscribe(CHANNELS.GLOBAL_ACTIVITY);
      pusherClient.unsubscribe(CHANNELS.MONITOR);
    };
  }, [taskId, limit, activityQuery, tasksQuery]);

  // Helper function to format activity for display
  const formatActivity = (activity: ActivityItem): string => {
    const userName = activity.user?.name || 'Unknown User';
    const taskTitle = activity.task?.title || 'Unknown Task';

    switch (activity.type) {
      case 'COMMENT_ADDED':
        return `${userName} commented on ${taskTitle}`;
      case 'COMMENT_DELETED':
        return `${userName} deleted a comment on ${taskTitle}`;
      case 'STATUS_CHANGED':
        let details = {};
        try {
          details = activity.details ? JSON.parse(activity.details) : {};
        } catch (e) {
          console.error('Failed to parse activity details:', e);
        }
        
        const { oldStatus, newStatus } = details as any;
        
        return `${userName} changed status of ${taskTitle} from ${oldStatus || 'previous status'} to ${newStatus || 'new status'}`;
      case 'TASK_CREATED':
        return `${userName} created task ${taskTitle}`;
      case 'TASK_UPDATED':
        return `${userName} updated task ${taskTitle}`;
      case 'TASK_DELETED':
        return `${userName} deleted task ${taskTitle}`;
      case 'SUBTASK_COMPLETED':
        return `${userName} completed a subtask in ${taskTitle}`;
      case 'ATTACHMENT_ADDED':
        return `${userName} added an attachment to ${taskTitle}`;
      case 'USER_ASSIGNED':
        return `${userName} was assigned to ${taskTitle}`;
      default:
        return `${userName} interacted with ${taskTitle}`;
    }
  };

  // Helper function to format time ago
  const formatTimeAgo = (date: Date): string => {
    return formatDistanceToNow(date, { addSuffix: true });
  };

  return {
    activities,
    activeTasks,
    activeUsers,
    loading,
    error,
    refresh: () => {
      activityQuery.refetch();
      tasksQuery.refetch();
      usersQuery.refetch();
    },
    formatActivity,
    formatTimeAgo,
  };
} 