import { useState, useEffect, useCallback } from 'react';

export interface FeedbackItem {
  id: string;
  rating: number;
  feedback?: string;
  featureInterest: string[];
  createdAt: string;
  userId?: string;
  user?: {
    id: string;
    name?: string;
    email: string;
  };
}

interface PaginationState {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface FilterState {
  rating?: number;
  feature?: string;
  startDate?: string;
  endDate?: string;
}

interface AdminFeedbackState {
  feedbackItems: FeedbackItem[];
  isLoading: boolean;
  error: string | null;
  pagination: PaginationState;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  refreshData: () => Promise<void>;
}

export function useAdminFeedback(): AdminFeedbackState {
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  });
  const [filters, setFilters] = useState<FilterState>({});

  const fetchFeedback = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query string from filters and pagination
      const queryParams = new URLSearchParams();
      
      if (filters.rating) {
        queryParams.append('rating', filters.rating.toString());
      }
      
      if (filters.feature) {
        queryParams.append('feature', filters.feature);
      }
      
      if (filters.startDate) {
        queryParams.append('startDate', filters.startDate);
      }
      
      if (filters.endDate) {
        queryParams.append('endDate', filters.endDate);
      }
      
      queryParams.append('page', pagination.page.toString());
      queryParams.append('limit', pagination.limit.toString());

      const response = await fetch(`/api/feedback?${queryParams.toString()}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch feedback');
      }
      
      const result = await response.json();
      
      setFeedbackItems(result.data);
      setPagination(result.pagination);
    } catch (err) {
      console.error('Error fetching feedback:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.limit, pagination.page]);

  // Fetch data on mount and when filters or pagination changes
  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const setPage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  return {
    feedbackItems,
    isLoading,
    error,
    pagination,
    filters,
    setFilters,
    setPage,
    setLimit,
    refreshData: fetchFeedback
  };
} 