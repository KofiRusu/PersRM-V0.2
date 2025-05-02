import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { getNextRecurrenceDate } from '@/lib/utils/recurrence';

export const recurrenceRouter = router({
  createRecurrence: publicProcedure
    .input(z.object({
      taskId: z.string(),
      pattern: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']),
      interval: z.number().min(1),
      endsAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { taskId, pattern, interval, endsAt } = input;

      // Check if task exists
      const task = await ctx.prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found',
        });
      }

      // Create recurrence
      const recurrence = await ctx.prisma.taskRecurrence.create({
        data: {
          pattern,
          interval,
          endsAt,
          tasks: { connect: { id: taskId } }
        }
      });

      return recurrence;
    }),

  updateRecurrence: publicProcedure
    .input(z.object({
      id: z.string(),
      pattern: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']).optional(),
      interval: z.number().min(1).optional(),
      endsAt: z.date().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Check if recurrence exists
      const recurrence = await ctx.prisma.taskRecurrence.findUnique({
        where: { id },
      });

      if (!recurrence) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recurrence not found',
        });
      }

      return ctx.prisma.taskRecurrence.update({
        where: { id },
        data: updateData,
      });
    }),

  deleteRecurrence: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if recurrence exists
      const recurrence = await ctx.prisma.taskRecurrence.findUnique({
        where: { id: input.id },
      });

      if (!recurrence) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recurrence not found',
        });
      }

      // Delete the recurrence
      await ctx.prisma.taskRecurrence.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  getRecurrenceByTask: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.task.findUnique({
        where: { id: input.taskId },
        include: { recurrence: true }
      });
    }),

  generateNextOccurrence: publicProcedure
    .input(z.object({ 
      taskId: z.string(),
      copySubtasks: z.boolean().default(true),
      copyLabels: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const { taskId, copySubtasks, copyLabels } = input;
      
      // Get the completed task with its recurrence information
      const task = await ctx.prisma.task.findUnique({
        where: { id: taskId },
        include: { 
          recurrence: true,
          subtasks: copySubtasks,
          labels: copyLabels,
        }
      });

      if (!task?.recurrence) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Task has no recurrence pattern',
        });
      }

      // Calculate the next due date
      const currentDueDate = task.dueDate || new Date();
      const nextDueDate = getNextRecurrenceDate(
        currentDueDate, 
        task.recurrence.pattern as any, 
        task.recurrence.interval
      );

      // Create the new recurring task instance
      const newTask = await ctx.prisma.task.create({
        data: {
          title: task.title,
          description: task.description,
          status: 'PENDING',
          priority: task.priority,
          dueDate: nextDueDate,
          userId: task.userId,
          recurrenceId: task.recurrence.id,
          
          // Copy labels if requested
          labels: copyLabels && task.labels.length > 0 
            ? {
                connect: task.labels.map(label => ({ 
                  id: label.id
                }))
              }
            : undefined,
        },
        include: {
          recurrence: true,
          labels: true,
        }
      });

      // Copy subtasks if requested
      if (copySubtasks && task.subtasks.length > 0) {
        const subtasksToCreate = task.subtasks.map(subtask => ({
          title: subtask.title,
          completed: false,
          taskId: newTask.id,
        }));

        await ctx.prisma.subtask.createMany({
          data: subtasksToCreate,
        });
      }

      return newTask;
    })
}); 