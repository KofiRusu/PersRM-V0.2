import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { appRouter } from '@/lib/server/trpc/routers/_app';
import { createInnerTRPCContext } from '@/lib/server/trpc/trpc';
import { CommentVisibility, PrismaClient, UserRole } from '@prisma/client';
import { pusherServer } from '@/lib/pusher';

// Mock Pusher
vi.mock('@/lib/pusher', () => ({
  pusherServer: {
    trigger: vi.fn().mockResolvedValue({}),
  },
  CHANNELS: {
    TASK_COMMENTS: (taskId: string) => `task:${taskId}:comments`,
    GLOBAL_ACTIVITY: 'global:activity',
  },
  EVENTS: {
    NEW_COMMENT: 'new-comment',
    EDIT_COMMENT: 'edit-comment',
    DELETE_COMMENT: 'delete-comment',
    COMMENT_HIDDEN: 'comment-hidden',
    COMMENT_UNHIDDEN: 'comment-unhidden',
    MOD_COMMENT_DELETED: 'mod-comment-deleted',
    NEW_ACTIVITY: 'new-activity',
  },
}));

const prisma = new PrismaClient();

// Test data
let testUser: any;
let adminUser: any;
let moderatorUser: any;
let testTask: any;
let publicComment: any;
let privateComment: any;
let hiddenComment: any;

describe('Comment Permissions and Moderation', () => {
  beforeAll(async () => {
    // Create test users and task
    testUser = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        role: UserRole.USER,
      },
    });
    
    adminUser = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      },
    });
    
    moderatorUser = await prisma.user.create({
      data: {
        name: 'Moderator User',
        email: 'mod@example.com',
        role: UserRole.MODERATOR,
      },
    });
    
    testTask = await prisma.task.create({
      data: {
        title: 'Test Task',
        description: 'Test Description',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        userId: testUser.id,
      },
    });
    
    // Create test comments with different visibilities
    publicComment = await prisma.comment.create({
      data: {
        content: 'This is a public comment',
        visibility: CommentVisibility.PUBLIC,
        taskId: testTask.id,
        userId: testUser.id,
      },
    });
    
    privateComment = await prisma.comment.create({
      data: {
        content: 'This is a private comment',
        visibility: CommentVisibility.PRIVATE,
        taskId: testTask.id,
        userId: testUser.id,
      },
    });
    
    hiddenComment = await prisma.comment.create({
      data: {
        content: 'This is a hidden comment',
        visibility: CommentVisibility.HIDDEN,
        taskId: testTask.id,
        userId: testUser.id,
        moderatedById: adminUser.id,
        moderationReason: 'Test moderation',
      },
    });
  });
  
  afterAll(async () => {
    // Clean up test data
    await prisma.comment.deleteMany({
      where: {
        taskId: testTask.id,
      },
    });
    
    await prisma.task.delete({
      where: {
        id: testTask.id,
      },
    });
    
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [testUser.id, adminUser.id, moderatorUser.id],
        },
      },
    });
    
    await prisma.$disconnect();
  });
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('Regular users should only see public comments and their own private comments', async () => {
    const ctx = createInnerTRPCContext({
      session: {
        user: {
          id: testUser.id,
          role: UserRole.USER,
        },
        expires: '',
      },
    });
    
    const caller = appRouter.createCaller(ctx);
    const result = await caller.comments.getCommentsByTaskId({ taskId: testTask.id });
    
    expect(result).toHaveLength(2);
    expect(result.some(c => c.id === publicComment.id)).toBe(true);
    expect(result.some(c => c.id === privateComment.id)).toBe(true);
    expect(result.some(c => c.id === hiddenComment.id)).toBe(false);
  });
  
  it('Moderators should see all comments by default except hidden ones', async () => {
    const ctx = createInnerTRPCContext({
      session: {
        user: {
          id: moderatorUser.id,
          role: UserRole.MODERATOR,
        },
        expires: '',
      },
    });
    
    const caller = appRouter.createCaller(ctx);
    const result = await caller.comments.getCommentsByTaskId({ taskId: testTask.id });
    
    expect(result).toHaveLength(2);
    expect(result.some(c => c.id === publicComment.id)).toBe(true);
    expect(result.some(c => c.id === privateComment.id)).toBe(true);
    expect(result.some(c => c.id === hiddenComment.id)).toBe(false);
  });
  
  it('Moderators should see hidden comments when includeHidden is true', async () => {
    const ctx = createInnerTRPCContext({
      session: {
        user: {
          id: moderatorUser.id,
          role: UserRole.MODERATOR,
        },
        expires: '',
      },
    });
    
    const caller = appRouter.createCaller(ctx);
    const result = await caller.comments.getCommentsByTaskId({ 
      taskId: testTask.id,
      includeHidden: true,
    });
    
    expect(result).toHaveLength(3);
    expect(result.some(c => c.id === publicComment.id)).toBe(true);
    expect(result.some(c => c.id === privateComment.id)).toBe(true);
    expect(result.some(c => c.id === hiddenComment.id)).toBe(true);
  });
  
  it('Regular users cannot hide comments', async () => {
    const ctx = createInnerTRPCContext({
      session: {
        user: {
          id: testUser.id,
          role: UserRole.USER,
        },
        expires: '',
      },
    });
    
    const caller = appRouter.createCaller(ctx);
    
    await expect(caller.comments.moderateComment({
      commentId: publicComment.id,
      visibility: CommentVisibility.HIDDEN,
    })).rejects.toThrow('You do not have permission to moderate comments');
  });
  
  it('Moderators can hide comments', async () => {
    const ctx = createInnerTRPCContext({
      session: {
        user: {
          id: moderatorUser.id,
          role: UserRole.MODERATOR,
        },
        expires: '',
      },
    });
    
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.comments.moderateComment({
      commentId: publicComment.id,
      visibility: CommentVisibility.HIDDEN,
      reason: 'Test reason',
    });
    
    expect(result.visibility).toBe(CommentVisibility.HIDDEN);
    expect(result.moderatedById).toBe(moderatorUser.id);
    expect(result.moderationReason).toBe('Test reason');
    
    // Verify Pusher event was triggered
    expect(pusherServer.trigger).toHaveBeenCalledWith(
      expect.stringContaining(testTask.id),
      'comment-hidden',
      expect.any(Object)
    );
  });
  
  it('Users can only edit their own comments', async () => {
    const ctx = createInnerTRPCContext({
      session: {
        user: {
          id: moderatorUser.id,
          role: UserRole.MODERATOR,
        },
        expires: '',
      },
    });
    
    const caller = appRouter.createCaller(ctx);
    
    // Create a comment for the moderator user
    const modComment = await prisma.comment.create({
      data: {
        content: 'Moderator comment',
        visibility: CommentVisibility.PUBLIC,
        taskId: testTask.id,
        userId: moderatorUser.id,
      },
    });
    
    // Can edit own comment
    const result = await caller.comments.updateComment({
      id: modComment.id,
      content: 'Updated moderator comment',
    });
    
    expect(result.content).toBe('Updated moderator comment');
    expect(result.edited).toBe(true);
    
    // Clean up
    await prisma.comment.delete({
      where: {
        id: modComment.id,
      },
    });
  });
  
  it('Admin can permanently delete comments', async () => {
    const ctx = createInnerTRPCContext({
      session: {
        user: {
          id: adminUser.id,
          role: UserRole.ADMIN,
        },
        expires: '',
      },
    });
    
    const caller = appRouter.createCaller(ctx);
    
    // Create a comment to delete
    const tempComment = await prisma.comment.create({
      data: {
        content: 'Temporary comment',
        visibility: CommentVisibility.PUBLIC,
        taskId: testTask.id,
        userId: testUser.id,
      },
    });
    
    // Admin can permanently delete the comment
    await caller.comments.deleteComment({
      id: tempComment.id,
      permanently: true,
    });
    
    // Verify comment is deleted
    const deletedComment = await prisma.comment.findUnique({
      where: {
        id: tempComment.id,
      },
    });
    
    expect(deletedComment).toBeNull();
  });
}); 