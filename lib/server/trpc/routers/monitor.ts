import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { ActivityType } from '@/lib/types/activity';

export const monitorRouter = router({
  getRecentActivity: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        userId: z.string().optional(),
        taskId: z.string().optional(),
        types: z.array(z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { limit, userId, taskId, types } = input;
        
        // Build the where clause based on input filters
        const where: any = {};
        
        if (userId) {
          where.userId = userId;
        }
        
        if (taskId) {
          where.taskId = taskId;
        }
        
        if (types && types.length > 0) {
          where.type = {
            in: types as ActivityType[],
          };
        }
        
        // Fetch the activity logs
        const activities = await ctx.prisma.taskActivity.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          take: limit,
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                updatedAt: true,
                userId: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        });
        
        return activities;
      } catch (error) {
        console.error('Error fetching recent activity:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch recent activity',
        });
      }
    }),
    
  getActiveTasks: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(10),
        userId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { limit, userId } = input;
        
        // Calculate the timestamp for 15 minutes ago
        const fifteenMinutesAgo = new Date();
        fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
        
        // Build the where clause based on input filters
        const where: any = {
          OR: [
            { status: 'IN_PROGRESS' },
            { updatedAt: { gte: fifteenMinutesAgo } },
          ],
        };
        
        if (userId) {
          where.userId = userId;
        }
        
        // Fetch the active tasks
        const activeTasks = await ctx.prisma.task.findMany({
          where,
          orderBy: {
            updatedAt: 'desc',
          },
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        });
        
        return activeTasks;
      } catch (error) {
        console.error('Error fetching active tasks:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch active tasks',
        });
      }
    }),
    
  getActiveUsers: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // This would typically come from a presence channel or a "heartbeat" system
        // For now, we'll mock it based on recent activity
        
        // Calculate the timestamp for 5 minutes ago
        const fiveMinutesAgo = new Date();
        fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
        
        // Get recent task activities as a proxy for active users
        const recentActivities = await ctx.prisma.taskActivity.findMany({
          where: {
            createdAt: {
              gte: fiveMinutesAgo,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            task: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          distinct: ['userId'],
          take: 10,
        });
        
        const activeUsers = recentActivities.map((activity) => ({
          userId: activity.userId,
          userName: activity.user?.name,
          userImage: activity.user?.image,
          taskId: activity.taskId,
          taskTitle: activity.task?.title || 'Unknown Task',
          lastActive: activity.createdAt,
          action: getActionFromActivityType(activity.type),
        }));
        
        return activeUsers;
      } catch (error) {
        console.error('Error fetching active users:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch active users',
        });
      }
    }),
    
  getDashboardData: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // Fetch recent activities (last 10)
        const recentActivities = await ctx.prisma.taskActivity.findMany({
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
                updatedAt: true,
                userId: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        });
        
        // Calculate the timestamp for 15 minutes ago
        const fifteenMinutesAgo = new Date();
        fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
        
        // Fetch active tasks
        const activeTasks = await ctx.prisma.task.findMany({
          where: {
            OR: [
              { status: 'IN_PROGRESS' },
              { updatedAt: { gte: fifteenMinutesAgo } },
            ],
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: 5,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        });
        
        // Calculate the timestamp for 5 minutes ago
        const fiveMinutesAgo = new Date();
        fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
        
        // Get recent task activities as a proxy for active users
        const recentUserActivities = await ctx.prisma.taskActivity.findMany({
          where: {
            createdAt: {
              gte: fiveMinutesAgo,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            task: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          distinct: ['userId'],
          take: 5,
        });
        
        const activeUsers = recentUserActivities.map((activity) => ({
          userId: activity.userId,
          userName: activity.user?.name,
          userImage: activity.user?.image,
          taskId: activity.taskId,
          taskTitle: activity.task?.title || 'Unknown Task',
          lastActive: activity.createdAt,
          action: getActionFromActivityType(activity.type),
        }));
        
        return {
          activities: recentActivities,
          activeTasks,
          activeUsers,
        };
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch dashboard data',
        });
      }
    }),
});

// Helper function to determine action type from activity type
function getActionFromActivityType(type: string): 'typing' | 'viewing' | 'editing' {
  switch (type) {
    case 'COMMENT_ADDED':
      return 'typing';
    case 'STATUS_CHANGED':
    case 'TASK_UPDATED':
      return 'editing';
    default:
      return 'viewing';
  }
} 