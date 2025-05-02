import { PrismaClient } from '@prisma/client';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const prisma = new PrismaClient();

describe('Comment Model Tests', () => {
  let taskId: string;
  let userId: string;
  let commentId: string;

  beforeAll(async () => {
    // Get a demo user for testing
    const user = await prisma.user.findFirst();
    userId = user?.id || '';
    
    // Create a test task
    const task = await prisma.task.create({
      data: {
        title: 'Test Task for Comments',
        description: 'This is a test task for testing comments',
        status: 'IN_PROGRESS',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    
    taskId = task.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (commentId) {
      await prisma.comment.delete({
        where: { id: commentId },
      }).catch(() => {
        // Ignore if comment was already deleted
      });
    }
    
    if (taskId) {
      await prisma.task.delete({
        where: { id: taskId },
      }).catch(() => {
        // Ignore if task was already deleted
      });
    }
    
    await prisma.$disconnect();
  });

  it('should create a comment', async () => {
    // Skip test if no user found
    if (!userId) {
      console.warn('No user found, skipping test');
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        taskId,
        userId,
        content: 'This is a test comment',
        visibility: 'PUBLIC',
      },
    });
    
    commentId = comment.id;
    
    expect(comment).toBeDefined();
    expect(comment.id).toBeDefined();
    expect(comment.content).toBe('This is a test comment');
    expect(comment.visibility).toBe('PUBLIC');
  });

  it('should fetch comments for a task', async () => {
    // Skip test if no comment was created
    if (!commentId) {
      console.warn('No comment created, skipping test');
      return;
    }

    const comments = await prisma.comment.findMany({
      where: {
        taskId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    expect(comments.length).toBeGreaterThan(0);
    expect(comments[0].content).toBe('This is a test comment');
    expect(comments[0].user).toBeDefined();
  });

  it('should update a comment', async () => {
    // Skip test if no comment was created
    if (!commentId) {
      console.warn('No comment created, skipping test');
      return;
    }

    const updatedComment = await prisma.comment.update({
      where: {
        id: commentId,
      },
      data: {
        content: 'This is an updated test comment',
        edited: true,
      },
    });
    
    expect(updatedComment).toBeDefined();
    expect(updatedComment.content).toBe('This is an updated test comment');
    expect(updatedComment.edited).toBe(true);
  });

  it('should delete a comment', async () => {
    // Skip test if no comment was created
    if (!commentId) {
      console.warn('No comment created, skipping test');
      return;
    }

    await prisma.comment.delete({
      where: {
        id: commentId,
      },
    });
    
    const deletedComment = await prisma.comment.findUnique({
      where: {
        id: commentId,
      },
    });
    
    expect(deletedComment).toBeNull();
    
    // Clear the commentId since it was deleted
    commentId = '';
  });
}); 