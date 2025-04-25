import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { prisma } from '@/lib/db';

export const assistantLogRouter = router({
  /**
   * Get overall summary of assistant usage
   */
  getOverallStats: publicProcedure.query(async () => {
    // Get total count by event type
    const openCount = await prisma.assistantLog.count({
      where: { event: 'open' },
    });
    
    const closeCount = await prisma.assistantLog.count({
      where: { event: 'close' },
    });
    
    // Get count by source
    const keyboardCount = await prisma.assistantLog.count({
      where: { source: 'keyboard' },
    });
    
    const buttonCount = await prisma.assistantLog.count({
      where: { source: 'button' },
    });
    
    // Calculate average session duration (if duration data exists)
    const avgDurationResult = await prisma.assistantLog.aggregate({
      _avg: { duration: true },
      where: { duration: { not: null } },
    });
    
    const avgDuration = avgDurationResult._avg.duration || 0;
    
    // Get total events count
    const totalEvents = await prisma.assistantLog.count();
    
    // Return stats
    return {
      totalEvents,
      openCount,
      closeCount,
      keyboardCount,
      buttonCount,
      avgDuration,
      // Calculate percentages
      keyboardPercentage: totalEvents > 0 ? (keyboardCount / totalEvents) * 100 : 0,
      buttonPercentage: totalEvents > 0 ? (buttonCount / totalEvents) * 100 : 0,
    };
  }),
  
  /**
   * Get daily usage statistics for a date range
   */
  getDailyStats: publicProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const { startDate, endDate } = input;
      
      // Set defaults if not provided
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const end = endDate || new Date();
      
      // Get daily counts
      const dailyStats = await prisma.$queryRaw`
        SELECT 
          date(createdAt) as date,
          COUNT(*) as count,
          COUNT(CASE WHEN event = 'open' THEN 1 END) as openCount,
          COUNT(CASE WHEN event = 'close' THEN 1 END) as closeCount,
          COUNT(CASE WHEN source = 'keyboard' THEN 1 END) as keyboardCount,
          COUNT(CASE WHEN source = 'button' THEN 1 END) as buttonCount,
          AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE NULL END) as avgDuration
        FROM AssistantLog
        WHERE createdAt BETWEEN ${start} AND ${end}
        GROUP BY date(createdAt)
        ORDER BY date(createdAt) ASC
      `;
      
      return {
        dailyStats,
      };
    }),
  
  /**
   * Get variant performance metrics for A/B testing
   */
  getVariantStats: publicProcedure.query(async () => {
    // Get count by variant
    const variantCounts = await prisma.assistantLog.groupBy({
      by: ['variant'],
      _count: true,
      where: {
        variant: { not: null },
      },
    });
    
    // Get average durations by variant
    const variantDurations = await prisma.assistantLog.groupBy({
      by: ['variant'],
      _avg: { duration: true },
      where: {
        variant: { not: null },
        duration: { not: null },
      },
    });
    
    // Combine the data
    const variantStats = variantCounts.map(variantCount => {
      const durationStat = variantDurations.find(d => d.variant === variantCount.variant);
      
      return {
        variant: variantCount.variant,
        count: variantCount._count,
        avgDuration: durationStat?._avg.duration || 0,
      };
    });
    
    return {
      variantStats,
    };
  }),
}); 