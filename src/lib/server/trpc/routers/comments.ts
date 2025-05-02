import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { triggerCommentEvent, EVENTS } from '@/lib/pusher';
import { CommentVisibility, UserRole } from '@prisma/client';

export const commentsRouter = router({
  getCommentsByTaskId: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      includeHidden: z.boolean().optional().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      const userRole = ctx.session?.user?.role || UserRole.USER;
      
      // Base where condition
      const whereCondition: any = {
        taskId: input.taskId,
        deleted: false,
      };
      
      // Filter visibility based on user role
      if (userRole !== UserRole.ADMIN && userRole !== UserRole.MODERATOR) {
        // Regular users can only see PUBLIC comments or their own PRIVATE comments
        whereCondition.OR = [
          { visibility: CommentVisibility.PUBLIC },
          { visibility: CommentVisibility.PRIVATE, userId },
        ];
      } else if (!input.includeHidden) {
        // Admins and moderators may opt to exclude hidden comments
        whereCondition.OR = [
          { visibility: CommentVisibility.PUBLIC },
          { visibility: CommentVisibility.PRIVATE },
        ];
      }
      // If moderator and includeHidden is true, no additional filtering needed
      
      const comments = await ctx.prisma.comment.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              role: true,
            },
          },
          moderatedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      return comments;
    }),
    
  createComment: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      content: z.string().min(1, 'Comment cannot be empty'),
      visibility: z.nativeEnum(CommentVisibility).optional().default(CommentVisibility.PUBLIC),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to create a comment',
        });
      }
      
      const comment = await ctx.prisma.comment.create({
        data: {
          content: input.content,
          visibility: input.visibility,
          taskId: input.taskId,
          userId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              role: true,
            },
          },
        },
      });
      
      // Log activity
      try {
        await ctx.prisma.taskActivity.create({
          data: {
            taskId: input.taskId,
            userId,
            type: 'COMMENT_ADDED',
            details: JSON.stringify({
              commentId: comment.id,
              content: input.content.substring(0, 50) + (input.content.length > 50 ? '...' : ''),
              visibility: input.visibility,
            }),
          },
        });
      } catch (error) {
        console.error('Failed to log comment activity:', error);
      }
      
      // Trigger Pusher event for real-time updates
      await triggerCommentEvent(input.taskId, EVENTS.NEW_COMMENT, comment);
      
      return comment;
    }),
    
  updateComment: protectedProcedure
    .input(z.object({
      id: z.string(),
      content: z.string().min(1, 'Comment cannot be empty'),
      visibility: z.nativeEnum(CommentVisibility).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      const userRole = ctx.session?.user?.role || UserRole.USER;
      
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to update a comment',
        });
      }
      
      const comment = await ctx.prisma.comment.findUnique({
        where: { id: input.id },
      });
      
      if (!comment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Comment not found',
        });
      }
      
      // Check if user has permission to edit
      const canEdit = comment.userId === userId || 
                     userRole === UserRole.ADMIN || 
                     userRole === UserRole.MODERATOR;
                     
      if (!canEdit) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only edit your own comments',
        });
      }
      
      const updatedComment = await ctx.prisma.comment.update({
        where: {
          id: input.id,
        },
        data: {
          content: input.content,
          edited: true,
          ...(input.visibility && { visibility: input.visibility }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              role: true,
            },
          },
          moderatedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      
      // Trigger Pusher event for real-time updates
      await triggerCommentEvent(comment.taskId, EVENTS.EDIT_COMMENT, updatedComment);
      
      return updatedComment;
    }),
    
  deleteComment: protectedProcedure
    .input(z.object({
      id: z.string(),
      permanently: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      const userRole = ctx.session?.user?.role || UserRole.USER;
      
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to delete a comment',
        });
      }
      
      const comment = await ctx.prisma.comment.findUnique({
        where: { id: input.id },
      });
      
      if (!comment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Comment not found',
        });
      }
      
      // Check permission to delete
      const canDelete = comment.userId === userId || 
                       userRole === UserRole.ADMIN || 
                       userRole === UserRole.MODERATOR;
                       
      if (!canDelete) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own comments',
        });
      }
      
      // Is this a moderator action?
      const isModAction = (userRole === UserRole.ADMIN || userRole === UserRole.MODERATOR) && 
                          comment.userId !== userId;
      
      if (input.permanently && userRole === UserRole.ADMIN) {
        // Hard delete (admin only)
        await ctx.prisma.comment.delete({
          where: { id: input.id },
        });
      } else {
        // Soft delete
        await ctx.prisma.comment.update({
          where: { id: input.id },
          data: {
            deleted: true,
            moderatedById: isModAction ? userId : null,
          },
        });
      }
      
      // Log activity
      try {
        await ctx.prisma.taskActivity.create({
          data: {
            taskId: comment.taskId,
            userId,
            type: isModAction ? 'MOD_COMMENT_DELETED' : 'COMMENT_DELETED',
            details: JSON.stringify({
              commentId: comment.id,
              permanent: input.permanently,
            }),
          },
        });
      } catch (error) {
        console.error('Failed to log comment deletion activity:', error);
      }
      
      // Trigger Pusher event for real-time updates
      await triggerCommentEvent(comment.taskId, 
        isModAction ? EVENTS.MOD_COMMENT_DELETED : EVENTS.DELETE_COMMENT, 
        { id: comment.id, taskId: comment.taskId });
      
      return { success: true };
    }),
    
  moderateComment: protectedProcedure
    .input(z.object({
      commentId: z.string(),
      visibility: z.nativeEnum(CommentVisibility),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      const userRole = ctx.session?.user?.role || UserRole.USER;
      
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to moderate comments',
        });
      }
      
      // Only moderators and admins can moderate comments
      if (userRole !== UserRole.ADMIN && userRole !== UserRole.MODERATOR) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to moderate comments',
        });
      }
      
      const comment = await ctx.prisma.comment.findUnique({
        where: { id: input.commentId },
      });
      
      if (!comment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Comment not found',
        });
      }
      
      // Update the comment visibility
      const updatedComment = await ctx.prisma.comment.update({
        where: {
          id: input.commentId,
        },
        data: {
          visibility: input.visibility,
          moderatedById: userId,
          moderationReason: input.reason,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              role: true,
            },
          },
          moderatedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      
      // Log the moderation activity
      let activityType = 'MOD_COMMENT_HIDDEN';
      if (input.visibility === CommentVisibility.PUBLIC) {
        activityType = 'MOD_COMMENT_UNHIDDEN';
      }
      
      try {
        await ctx.prisma.taskActivity.create({
          data: {
            taskId: comment.taskId,
            userId,
            type: activityType,
            details: JSON.stringify({
              commentId: comment.id,
              visibility: input.visibility,
              reason: input.reason,
            }),
          },
        });
      } catch (error) {
        console.error('Failed to log comment moderation activity:', error);
      }
      
      // Trigger appropriate Pusher event
      const eventType = input.visibility === CommentVisibility.HIDDEN 
        ? EVENTS.COMMENT_HIDDEN 
        : EVENTS.COMMENT_UNHIDDEN;
        
      await triggerCommentEvent(comment.taskId, eventType, updatedComment);
      
      return updatedComment;
    }),
    
  sendTypingIndicator: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      isTyping: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      const userName = ctx.session?.user?.name || 'Someone';
      
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in',
        });
      }
      
      // Trigger Pusher event for typing indicator
      await triggerCommentEvent(input.taskId, EVENTS.TYPING, { 
        userId, 
        userName, 
        isTyping: input.isTyping,
        timestamp: new Date().toISOString(),
      });
      
      return { success: true };
    }),
}); 