import { PrismaClient } from '@prisma/client';

// Initialize Prisma client
const prisma = new PrismaClient();

export type FeedbackData = {
  rating: number;
  feedback?: string;
  featureInterest: string[];
  userId?: string;
};

/**
 * Submit new beta feedback
 */
export async function submitBetaFeedback(data: FeedbackData) {
  try {
    const feedback = await prisma.betaFeedback.create({
      data: {
        rating: data.rating,
        feedback: data.feedback,
        featureInterest: data.featureInterest,
        userId: data.userId,
      },
    });
    return { success: true, data: feedback };
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return { success: false, error };
  }
}

/**
 * Get all feedback for a specific user
 */
export async function getUserFeedback(userId: string) {
  try {
    const feedback = await prisma.betaFeedback.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return { success: true, data: feedback };
  } catch (error) {
    console.error('Error fetching user feedback:', error);
    return { success: false, error };
  }
}

/**
 * Get all feedback for admin reporting
 */
export async function getAllFeedback() {
  try {
    const feedback = await prisma.betaFeedback.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return { success: true, data: feedback };
  } catch (error) {
    console.error('Error fetching all feedback:', error);
    return { success: false, error };
  }
} 