import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { generateSlug } from '@/lib/utils/generateSlug';
import { logTaskActivity } from '@/lib/server/logActivity';

export const tasksRouter = router({
  getTasks: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      priority: z.string().optional(),
      search: z.string().optional(),
      labelIds: z.array(z.string()).optional(),
      sortBy: z.string().optional(),
      sortDirection: z.enum(['asc', 'desc']).optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { status, priority, search, labelIds, sortBy, sortDirection, startDate, endDate } = input;
      
      // Build where clause
      let whereClause: any = {};
      
      if (status) {
        whereClause.status = status;
      }
      
      if (priority) {
        whereClause.priority = priority;
      }
      
      if (search) {
        whereClause.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }
      
      // Filter by date range if provided
      if (startDate || endDate) {
        whereClause.dueDate = {};
        
        if (startDate) {
          whereClause.dueDate.gte = startDate;
        }
        
        if (endDate) {
          whereClause.dueDate.lte = endDate;
        }
      }
      
      // Filter by labels if specified
      if (labelIds && labelIds.length > 0) {
        whereClause.labels = {
          some: {
            id: { in: labelIds }
          }
        };
      }
      
      // Build orderBy clause
      let orderByClause: any = { createdAt: 'desc' };
      
      if (sortBy) {
        orderByClause = {
          [sortBy]: sortDirection || 'asc'
        };
      }
      
      // Get tasks
      return ctx.prisma.task.findMany({
        where: whereClause,
        orderBy: orderByClause,
        include: {
          labels: true,
          subtasks: true,
          recurrence: true,
        },
      });
    }),
  
  getTaskById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({
        where: { id: input.id },
        include: {
          labels: true,
          subtasks: true,
          recurrence: true,
          blockedBy: {
            include: {
              dependsOnTask: true,
            },
          },
        },
      });
      
      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found',
        });
      }
      
      return task;
    }),
  
  createTask: publicProcedure
    .input(z.object({
      title: z.string(),
      description: z.string().optional(),
      status: z.string().default('PENDING'),
      priority: z.string().default('MEDIUM'),
      dueDate: z.date().optional(),
      labelIds: z.array(z.string()).optional(),
      userId: z.string().default('user-1'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { title, description, status, priority, dueDate, labelIds, userId } = input;
      
      // Create task
      const task = await ctx.prisma.task.create({
        data: {
          title,
          description,
          status,
          priority,
          dueDate,
          userId,
          labels: labelIds && labelIds.length > 0
            ? { connect: labelIds.map(id => ({ id })) }
            : undefined,
        },
        include: {
          labels: true,
          recurrence: true,
        },
      });
      
      // Log activity
      await logTaskActivity(ctx.prisma, {
        type: 'CREATED',
        taskId: task.id,
        userId,
        content: 'Task created',
      });
      
      return task;
    }),
  
  updateTask: publicProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      priority: z.string().optional(),
      dueDate: z.date().optional().nullable(),
      labelIds: z.array(z.string()).optional(),
      userId: z.string().default('user-1'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, title, description, status, priority, dueDate, labelIds, userId } = input;
      
      // Check if task exists
      const existingTask = await ctx.prisma.task.findUnique({
        where: { id },
        include: { labels: true },
      });
      
      if (!existingTask) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found',
        });
      }
      
      // Build update data
      const updateData: any = {};
      let activityContent = '';
      
      if (title !== undefined && title !== existingTask.title) {
        updateData.title = title;
        activityContent += `Title changed to "${title}". `;
      }
      
      if (description !== undefined && description !== existingTask.description) {
        updateData.description = description;
        activityContent += 'Description updated. ';
      }
      
      if (status !== undefined && status !== existingTask.status) {
        updateData.status = status;
        activityContent += `Status changed to ${status}. `;
      }
      
      if (priority !== undefined && priority !== existingTask.priority) {
        updateData.priority = priority;
        activityContent += `Priority set to ${priority}. `;
      }
      
      if (dueDate !== undefined && 
          (!existingTask.dueDate || dueDate === null || 
           new Date(dueDate).toISOString() !== new Date(existingTask.dueDate).toISOString())) {
        updateData.dueDate = dueDate;
        activityContent += dueDate ? `Due date set to ${dueDate.toLocaleDateString()}. ` : 'Due date removed. ';
      }
      
      // Handle label updates if provided
      let labelOperation;
      if (labelIds !== undefined) {
        // Get current label IDs
        const currentLabelIds = existingTask.labels.map(label => label.id);
        
        // Determine differences
        const addedLabels = labelIds.filter(id => !currentLabelIds.includes(id));
        const removedLabels = currentLabelIds.filter(id => !labelIds.includes(id));
        
        // Set up label operations
        labelOperation = {
          disconnect: removedLabels.map(id => ({ id })),
          connect: addedLabels.map(id => ({ id })),
        };
        
        if (addedLabels.length > 0) {
          activityContent += `Added ${addedLabels.length} label(s). `;
        }
        
        if (removedLabels.length > 0) {
          activityContent += `Removed ${removedLabels.length} label(s). `;
        }
      }
      
      // Update task
      const updatedTask = await ctx.prisma.task.update({
        where: { id },
        data: {
          ...updateData,
          labels: labelOperation,
        },
        include: {
          labels: true,
          recurrence: true,
        },
      });
      
      // Log activity if there were changes
      if (activityContent) {
        await logTaskActivity(ctx.prisma, {
          type: 'UPDATED',
          taskId: id,
          userId,
          content: activityContent.trim(),
        });
      }
      
      return updatedTask;
    }),
  
  deleteTask: publicProcedure
    .input(z.object({
      id: z.string(),
      userId: z.string().default('user-1'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, userId } = input;
      
      // Check if task exists
      const task = await ctx.prisma.task.findUnique({
        where: { id },
      });
      
      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found',
        });
      }
      
      // Delete task
      await ctx.prisma.task.delete({
        where: { id },
      });
      
      return { success: true };
    }),
  
  shareTask: publicProcedure
    .input(z.object({
      id: z.string(),
      userId: z.string().default('user-1'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, userId } = input;
      
      // Generate a unique slug
      const slug = await generateSlug();
      
      // Update task with public flag and slug
      const updatedTask = await ctx.prisma.task.update({
        where: { id },
        data: {
          isPublic: true,
          publicSlug: slug,
        },
      });
      
      // Log activity
      await logTaskActivity(ctx.prisma, {
        type: 'SHARED',
        taskId: id,
        userId,
        content: 'Task shared publicly',
      });
      
      return {
        success: true,
        publicSlug: updatedTask.publicSlug,
      };
    }),
  
  revokePublicAccess: publicProcedure
    .input(z.object({
      id: z.string(),
      userId: z.string().default('user-1'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, userId } = input;
      
      // Update task to revoke public access
      await ctx.prisma.task.update({
        where: { id },
        data: {
          isPublic: false,
          publicSlug: null,
        },
      });
      
      // Log activity
      await logTaskActivity(ctx.prisma, {
        type: 'SHARED',
        taskId: id,
        userId,
        content: 'Public access revoked',
      });
      
      return { success: true };
    }),
  
  getPublicTask: publicProcedure
    .input(z.object({
      slug: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({
        where: { publicSlug: input.slug },
        include: {
          labels: true,
          subtasks: true,
          recurrence: true,
        },
      });
      
      if (!task || !task.isPublic) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found or not public',
        });
      }
      
      return task;
    }),
  
  getTaskStats: publicProcedure
    .query(async ({ ctx }) => {
      // Get task counts by status
      const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BACKLOG'];
      const statusCounts = await Promise.all(
        statuses.map(async (status) => {
          const count = await ctx.prisma.task.count({
            where: { status },
          });
          return { status, count };
        })
      );
      
      // Get overdue tasks
      const overdueTasks = await ctx.prisma.task.count({
        where: {
          dueDate: { lt: new Date() },
          status: { notIn: ['COMPLETED'] },
        },
      });
      
      // Get tasks by priority
      const priorities = ['HIGH', 'MEDIUM', 'LOW'];
      const priorityCounts = await Promise.all(
        priorities.map(async (priority) => {
          const count = await ctx.prisma.task.count({
            where: { priority },
          });
          return { priority, count };
        })
      );
      
      // Get tasks due this week
      const today = new Date();
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
      
      const dueThisWeek = await ctx.prisma.task.count({
        where: {
          dueDate: {
            gte: today,
            lte: endOfWeek,
          },
          status: { notIn: ['COMPLETED'] },
        },
      });
      
      // Get recurring tasks count
      const recurringTasks = await ctx.prisma.task.count({
        where: {
          recurrenceId: { not: null },
        },
      });
      
      return {
        byStatus: statusCounts,
        byPriority: priorityCounts,
        overdue: overdueTasks,
        dueThisWeek,
        recurring: recurringTasks,
      };
    }),
}); 