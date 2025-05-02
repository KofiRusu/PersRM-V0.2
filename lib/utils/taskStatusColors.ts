type ColorScheme = {
  bg: string;
  text: string;
  border: string;
};

type StatusColorMap = {
  [key: string]: ColorScheme;
};

export const taskStatusColors: StatusColorMap = {
  // Default statuses
  PENDING: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  IN_PROGRESS: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  COMPLETED: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
  },
  BLOCKED: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
  },
  BACKLOG: {
    bg: 'bg-gray-100 dark:bg-gray-800/50',
    text: 'text-gray-800 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
  },
  ARCHIVED: {
    bg: 'bg-slate-100 dark:bg-slate-800/50',
    text: 'text-slate-800 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

// Function to get color for a status (with fallback to default)
export const getStatusColor = (status: string): ColorScheme => {
  const normalizedStatus = status.toUpperCase().replace(/ /g, '_');
  return (
    taskStatusColors[normalizedStatus] ||
    taskStatusColors[status] || // Try direct match
    taskStatusColors.PENDING // Default fallback
  );
};

// Helper to render status text with appropriate casing/spacing
export const formatStatusText = (status: string): string => {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}; 