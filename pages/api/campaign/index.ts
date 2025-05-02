import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type ErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any | ErrorResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    // TODO: Implement authentication check
    // For future: if (!isAuthenticated(req.session?.user)) {
    //   return res.status(401).json({ error: 'Unauthorized' });
    // }

    const { campaignId, userId, includeItems = 'true' } = req.query;

    // Case 1: Get specific campaign with items
    if (campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId as string },
        include: {
          items: includeItems === 'true',
        },
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      return res.status(200).json(campaign);
    }

    // Case 2: Get all campaigns for a user
    if (userId) {
      const campaigns = await prisma.campaign.findMany({
        where: { userId: userId as string },
        include: {
          items: includeItems === 'true',
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      return res.status(200).json(campaigns);
    }

    // Case 3: Get all campaigns (should be admin only in a real app)
    const campaigns = await prisma.campaign.findMany({
      include: {
        items: includeItems === 'true',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return res.status(200).json(campaigns);
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error'
    });
  }
} 