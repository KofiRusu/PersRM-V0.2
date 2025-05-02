import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllFeedback } from '@/lib/db/betaFeedback';

// Response types
type ErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any | ErrorResponse>
) {
  // Check request method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // TODO: Add authentication check here
    // For future: if (!isAdmin(req.session?.user)) {
    //   return res.status(403).json({ error: 'Unauthorized' });
    // }

    // Extract query parameters for filtering/pagination
    const { 
      rating, 
      feature, 
      startDate, 
      endDate, 
      page = '1', 
      limit = '10' 
    } = req.query;

    // Get all feedback using the existing service function
    const result = await getAllFeedback();

    if (!result.success) {
      throw new Error('Failed to fetch feedback');
    }

    let filteredData = result.data;

    // Apply filters
    if (rating) {
      filteredData = filteredData.filter(item => item.rating === parseInt(rating as string));
    }

    if (feature) {
      filteredData = filteredData.filter(item => 
        item.featureInterest.includes(feature as string)
      );
    }

    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      filteredData = filteredData.filter(item => {
        const date = new Date(item.createdAt);
        return date >= start && date <= end;
      });
    }

    // Apply pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = pageNum * limitNum;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    // Return paginated results with metadata
    return res.status(200).json({
      data: paginatedData,
      pagination: {
        total: filteredData.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(filteredData.length / limitNum)
      }
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 