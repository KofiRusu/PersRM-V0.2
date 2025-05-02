import Pusher from 'pusher';
import PusherClient from 'pusher-js';

// For server-side
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID || 'app-id',
  key: process.env.PUSHER_KEY || 'key',
  secret: process.env.PUSHER_SECRET || 'secret',
  cluster: process.env.PUSHER_CLUSTER || 'us2',
  useTLS: true,
});

// For client-side
export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY || 'key',
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
  }
);

// Channel naming conventions
export const CHANNELS = {
  TASK_COMMENTS: (taskId: string) => `task:${taskId}:comments`,
  TASK_STATUS: (taskId: string) => `task:${taskId}:status`,
  TASK_ACTIVITY: (taskId: string) => `task:${taskId}:activity`,
  GLOBAL_ACTIVITY: 'global:activity',
  MONITOR: 'monitor',
  USER_PRESENCE: (userId: string) => `presence:user:${userId}`,
};

// Event types
export const EVENTS = {
  // Comment events
  NEW_COMMENT: 'new-comment',
  EDIT_COMMENT: 'edit-comment',
  DELETE_COMMENT: 'delete-comment',
  MOD_COMMENT_DELETED: 'mod-comment-deleted',
  COMMENT_HIDDEN: 'comment-hidden',
  COMMENT_UNHIDDEN: 'comment-unhidden',
  TYPING: 'typing',
  
  // Task status events
  STATUS_CHANGED: 'status-changed',
  
  // Activity events
  NEW_ACTIVITY: 'new-activity',
  
  // Monitor events
  ACTIVE_TASK_UPDATE: 'active-task-update',
  ACTIVE_USER_UPDATE: 'active-user-update',
};

// Helper function to trigger comment events
export const triggerCommentEvent = async (
  taskId: string,
  eventName: string,
  data: any
) => {
  try {
    await pusherServer.trigger(CHANNELS.TASK_COMMENTS(taskId), eventName, data);
    // Also trigger global activity for comments (for the monitor)
    if (
      eventName === EVENTS.NEW_COMMENT || 
      eventName === EVENTS.DELETE_COMMENT ||
      eventName === EVENTS.MOD_COMMENT_DELETED ||
      eventName === EVENTS.COMMENT_HIDDEN ||
      eventName === EVENTS.COMMENT_UNHIDDEN
    ) {
      const activityType = 
        eventName === EVENTS.NEW_COMMENT ? 'COMMENT_ADDED' :
        eventName === EVENTS.DELETE_COMMENT ? 'COMMENT_DELETED' :
        eventName === EVENTS.MOD_COMMENT_DELETED ? 'MOD_COMMENT_DELETED' :
        eventName === EVENTS.COMMENT_HIDDEN ? 'MOD_COMMENT_HIDDEN' :
        'MOD_COMMENT_UNHIDDEN';
      
      await pusherServer.trigger(CHANNELS.GLOBAL_ACTIVITY, EVENTS.NEW_ACTIVITY, {
        type: activityType,
        taskId,
        data,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Failed to trigger Pusher event:', error);
  }
};

// Helper function to trigger task status events
export const triggerStatusEvent = async (
  taskId: string,
  oldStatus: string,
  newStatus: string,
  userId: string,
  taskTitle: string
) => {
  try {
    const data = {
      taskId,
      oldStatus,
      newStatus,
      userId,
      taskTitle,
      timestamp: new Date().toISOString(),
    };
    
    // Trigger on task-specific channel
    await pusherServer.trigger(CHANNELS.TASK_STATUS(taskId), EVENTS.STATUS_CHANGED, data);
    
    // Also trigger on global activity channel for the monitor
    await pusherServer.trigger(CHANNELS.GLOBAL_ACTIVITY, EVENTS.NEW_ACTIVITY, {
      type: 'STATUS_CHANGED',
      taskId,
      data,
      timestamp: new Date().toISOString(),
    });
    
    // Update monitor with new active task data
    await pusherServer.trigger(CHANNELS.MONITOR, EVENTS.ACTIVE_TASK_UPDATE, {
      taskId,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to trigger status event:', error);
  }
};

// Helper function to broadcast user activity
export const broadcastUserActivity = async (
  userId: string,
  userName: string,
  taskId: string,
  taskTitle: string,
  action: 'typing' | 'viewing' | 'editing'
) => {
  try {
    const data = {
      userId,
      userName,
      taskId,
      taskTitle,
      action,
      lastActive: new Date().toISOString(),
    };
    
    await pusherServer.trigger(CHANNELS.MONITOR, EVENTS.ACTIVE_USER_UPDATE, data);
  } catch (error) {
    console.error('Failed to broadcast user activity:', error);
  }
}; 