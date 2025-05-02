import { useState } from 'react';
import { FeedbackItem } from '@/hooks/useAdminFeedback';
import { StarRating } from '@/components/StarRating';
import { Button } from '@/components/ui';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { FeedbackDetailsModal } from '@/components/FeedbackDetailsModal';

interface AdminFeedbackTableProps {
  feedbackItems: FeedbackItem[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
}

export function AdminFeedbackTable({
  feedbackItems,
  isLoading,
  error,
  pagination,
  onPageChange
}: AdminFeedbackTableProps) {
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);

  // Format date to readable string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Truncate text for display
  const truncateText = (text: string | undefined, maxLength = 50) => {
    if (!text) return '';
    return text.length > maxLength
      ? `${text.substring(0, maxLength)}...`
      : text;
  };

  // Open the details modal
  const handleViewDetails = (feedback: FeedbackItem) => {
    setSelectedFeedback(feedback);
  };

  // Close the details modal
  const handleCloseDetails = () => {
    setSelectedFeedback(null);
  };

  // Show empty state when no data
  if (feedbackItems.length === 0 && !isLoading && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">No feedback yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          No feedback has been submitted by beta testers yet.
        </p>
      </div>
    );
  }

  // Show loader when loading
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="text-center py-12 px-4">
        <div className="text-red-500 mb-4">
          <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">Error loading feedback</h3>
        <p className="mt-1 text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              User
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rating
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Features
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Feedback
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {feedbackItems.map((feedback) => (
            <tr key={feedback.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {feedback.user?.name || 'Anonymous'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {feedback.user?.email || 'No email'}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <StarRating rating={feedback.rating} onChange={() => {}} disabled={true} size={16} />
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-wrap gap-1">
                  {feedback.featureInterest.map((feature) => (
                    <span
                      key={feature}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900 max-w-xs">
                  {truncateText(feedback.feedback)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(feedback.createdAt)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Button 
                  size="sm"
                  variant="outline" 
                  onClick={() => handleViewDetails(feedback)}
                >
                  View Details
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <Button
            variant="outline"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-medium">{pagination.total}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <Button
                variant="outline"
                className="relative inline-flex items-center px-2 py-2 rounded-l-md text-sm font-medium"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <span className="sr-only">Previous</span>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </Button>
              
              {/* Page numbers */}
              {Array.from({ length: pagination.totalPages }).map((_, index) => {
                const pageNumber = index + 1;
                const isCurrentPage = pageNumber === pagination.page;
                
                return (
                  <Button
                    key={pageNumber}
                    variant={isCurrentPage ? "default" : "outline"}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${
                      isCurrentPage ? 'z-10' : ''
                    }`}
                    onClick={() => onPageChange(pageNumber)}
                  >
                    {pageNumber}
                  </Button>
                );
              })}
              
              <Button
                variant="outline"
                className="relative inline-flex items-center px-2 py-2 rounded-r-md text-sm font-medium"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                <span className="sr-only">Next</span>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </Button>
            </nav>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {selectedFeedback && (
        <FeedbackDetailsModal
          feedback={selectedFeedback}
          isOpen={!!selectedFeedback}
          onClose={handleCloseDetails}
        />
      )}
    </div>
  );
} 