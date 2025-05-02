export interface User {
  id: string;
  name?: string | null;
  image?: string | null;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  updatedAt: Date;
  userId: string; // Assignee
  user?: User; // Assignee details
}

export type ActivityType = 
  | 'COMMENT_ADDED'
  | 'COMMENT_DELETED'
  | 'STATUS_CHANGED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_DELETED'
  | 'SUBTASK_COMPLETED'
  | 'ATTACHMENT_ADDED'
  | 'USER_ASSIGNED';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  taskId: string;
  userId: string;
  createdAt: Date;
  details?: string; // JSON string with additional metadata
  task?: Task;
  user?: User;
}

export interface ActiveUser {
  userId: string;
  userName: string | null;
  userImage?: string | null;
  taskId: string;
  taskTitle: string;
  lastActive: Date;
  action: 'typing' | 'viewing' | 'editing';
}

export interface MonitorData {
  activities: ActivityItem[];
  activeTasks: Task[];
  activeUsers: ActiveUser[];
} 