import { useState } from 'react';
import { useAdminFeedback } from '@/hooks/useAdminFeedback';
import { AdminFeedbackTable } from '@/components/AdminFeedbackTable';
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui';
import { Download, RefreshCw, Filter } from 'lucide-react';

export default function AdminFeedbackDashboard() {
  // Initialize the feedback hook
  const {
    feedbackItems,
    isLoading,
    error,
    pagination,
    setPage,
    setFilters,
    filters,
    refreshData
  } = useAdminFeedback();

  // State for filter controls
  const [rating, setRating] = useState<string>('');
  const [feature, setFeature] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Handle applying filters
  const handleApplyFilters = () => {
    setFilters({
      ...filters,
      rating: rating ? parseInt(rating) : undefined,
      feature: feature || undefined
    });
  };

  // Handle clearing filters
  const handleClearFilters = () => {
    setRating('');
    setFeature('');
    setFilters({});
  };

  // Handle CSV export
  const handleExportCSV = () => {
    // This is a simple CSV export implementation
    // In a real app, you might want to use a library like 'papaparse'
    if (feedbackItems.length === 0) return;

    const headers = [
      'User',
      'Email',
      'Rating',
      'Features',
      'Feedback',
      'Date'
    ];

    const rows = feedbackItems.map(item => [
      item.user?.name || 'Anonymous',
      item.user?.email || 'No email',
      item.rating,
      item.featureInterest.join(', '),
      item.feedback || '',
      new Date(item.createdAt).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `feedback-export-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beta Feedback</h1>
          <p className="mt-2 text-sm text-gray-700">
            Review and analyze feedback submitted by beta testers.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <Button
            variant="outline"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>

          <Button
            variant="outline"
            onClick={refreshData}
            className="flex items-center"
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="flex items-center"
            disabled={feedbackItems.length === 0 || isLoading}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      {isFilterOpen && (
        <div className="mt-6 bg-white shadow rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label htmlFor="rating" className="block text-sm font-medium text-gray-700">
                Rating
              </label>
              <Select
                value={rating}
                onValueChange={setRating}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All ratings</SelectItem>
                  <SelectItem value="1">1 Star</SelectItem>
                  <SelectItem value="2">2 Stars</SelectItem>
                  <SelectItem value="3">3 Stars</SelectItem>
                  <SelectItem value="4">4 Stars</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label htmlFor="feature" className="block text-sm font-medium text-gray-700">
                Feature Interest
              </label>
              <Select
                value={feature}
                onValueChange={setFeature}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All features" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All features</SelectItem>
                  <SelectItem value="campaigns">Campaigns</SelectItem>
                  <SelectItem value="automation">Automation</SelectItem>
                  <SelectItem value="analytics">Analytics</SelectItem>
                  <SelectItem value="integrations">Integrations</SelectItem>
                  <SelectItem value="reporting">Reporting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end space-x-3">
              <Button onClick={handleApplyFilters}>Apply Filters</Button>
              <Button variant="outline" onClick={handleClearFilters}>Clear</Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 bg-white shadow rounded-lg overflow-hidden">
        <AdminFeedbackTable
          feedbackItems={feedbackItems}
          isLoading={isLoading}
          error={error}
          pagination={pagination}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
} 