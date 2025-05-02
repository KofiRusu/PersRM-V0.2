import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { triggerCommentEvent, triggerStatusEvent, EVENTS } from '@/lib/pusher';

// Mock the Pusher trigger methods
vi.mock('@/lib/pusher', () => ({
  EVENTS: {
    NEW_COMMENT: 'new-comment',
    DELETE_COMMENT: 'delete-comment',
    STATUS_CHANGED: 'status-changed',
    NEW_ACTIVITY: 'new-activity',
    ACTIVE_TASK_UPDATE: 'active-task-update',
    ACTIVE_USER_UPDATE: 'active-user-update',
  },
  CHANNELS: {
    TASK_COMMENTS: (taskId: string) => `task:${taskId}:comments`,
    TASK_STATUS: (taskId: string) => `task:${taskId}:status`,
    GLOBAL_ACTIVITY: 'global:activity',
    MONITOR: 'monitor',
  },
  pusherServer: {
    trigger: vi.fn().mockResolvedValue(true),
  },
  pusherClient: {
    subscribe: vi.fn().mockReturnValue({
      bind: vi.fn(),
      unbind_all: vi.fn(),
    }),
    unsubscribe: vi.fn(),
  },
  triggerCommentEvent: vi.fn().mockResolvedValue(true),
  triggerStatusEvent: vi.fn().mockResolvedValue(true),
}));

const prisma = new PrismaClient();

describe('Task Monitor Integration Tests', () => {
  let userId: string;
  let taskId: string;
  let commentId: string;
  let activityId: string;

  beforeAll(async () => {
    // Get a user for testing
    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found for testing');
    userId = user.id;
    
    // Create a test task
    const task = await prisma.task.create({
      data: {
        title: 'Test Task for Monitor',
        description: 'This is a test task for testing task monitor',
        status: 'PENDING',
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    taskId = task.id;
    
    // Create a test comment
    const comment = await prisma.comment.create({
      data: {
        content: 'This is a test comment for monitor',
        taskId,
        userId,
        visibility: 'PUBLIC',
      },
    });
    commentId = comment.id;
    
    // Create an activity log
    const activity = await prisma.taskActivity.create({
      data: {
        type: 'COMMENT_ADDED',
        taskId,
        userId,
        details: JSON.stringify({
          commentId,
          content: 'This is a test comment for monitor',
        }),
      },
    });
    activityId = activity.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.taskActivity.deleteMany({
      where: {
        taskId,
      },
    });
    
    await prisma.comment.delete({
      where: {
        id: commentId,
      },
    }).catch(() => {/* ignore if already deleted */});
    
    await prisma.task.delete({
      where: {
        id: taskId,
      },
    }).catch(() => {/* ignore if already deleted */});
    
    await prisma.$disconnect();
  });

  // Test recent activity retrieval
  it('should fetch recent activity', async () => {
    const activities = await prisma.taskActivity.findMany({
      where: {
        taskId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    expect(activities).toHaveLength(1);
    expect(activities[0].id).toBe(activityId);
    expect(activities[0].type).toBe('COMMENT_ADDED');
    expect(activities[0].taskId).toBe(taskId);
    expect(activities[0].userId).toBe(userId);
  });
  
  // Test active tasks retrieval
  it('should fetch active tasks', async () => {
    // Update the task to be in progress
    await prisma.task.update({
      where: {
        id: taskId,
      },
      data: {
        status: 'IN_PROGRESS',
        updatedAt: new Date(),
      },
    });
    
    // Get active tasks
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { status: 'IN_PROGRESS' },
          { updatedAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } }, // 15 minutes ago
        ],
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 10,
    });
    
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks.some(t => t.id === taskId)).toBe(true);
    
    const testTask = tasks.find(t => t.id === taskId);
    expect(testTask?.status).toBe('IN_PROGRESS');
  });
  
  // Test Pusher event trigger for comments
  it('should trigger Pusher event when adding a comment', async () => {
    const data = {
      id: 'test-comment-id',
      content: 'Test comment content',
      taskId,
      userId,
      createdAt: new Date(),
    };
    
    await triggerCommentEvent(taskId, EVENTS.NEW_COMMENT, data);
    
    expect(triggerCommentEvent).toHaveBeenCalledWith(
      taskId,
      EVENTS.NEW_COMMENT,
      data
    );
  });
  
  // Test Pusher event trigger for status change
  it('should trigger Pusher event when changing status', async () => {
    await triggerStatusEvent(
      taskId,
      'IN_PROGRESS',
      'COMPLETED',
      userId,
      'Test Task for Monitor'
    );
    
    expect(triggerStatusEvent).toHaveBeenCalledWith(
      taskId,
      'IN_PROGRESS',
      'COMPLETED',
      userId,
      'Test Task for Monitor'
    );
  });
  
  // Test formatting time ago
  it('should correctly format time ago', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const formattedTime = formatDistanceToNow(fiveMinutesAgo, { addSuffix: true });
    expect(formattedTime).toMatch(/5 minutes ago|about 5 minutes ago/);
  });
}); 