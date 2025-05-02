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
};

// Event types
export const EVENTS = {
  NEW_COMMENT: 'new-comment',
  EDIT_COMMENT: 'edit-comment',
  DELETE_COMMENT: 'delete-comment',
  TYPING: 'typing',
};

// Helper function to trigger comment events
export const triggerCommentEvent = async (
  taskId: string,
  eventName: string,
  data: any
) => {
  try {
    await pusherServer.trigger(CHANNELS.TASK_COMMENTS(taskId), eventName, data);
  } catch (error) {
    console.error('Failed to trigger Pusher event:', error);
  }
}; 