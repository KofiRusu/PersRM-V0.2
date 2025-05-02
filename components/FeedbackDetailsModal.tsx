import { FeedbackItem } from '@/hooks/useAdminFeedback';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  Button
} from '@/components/ui';
import { StarRating } from '@/components/StarRating';

interface FeedbackDetailsModalProps {
  feedback: FeedbackItem;
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackDetailsModal({ 
  feedback, 
  isOpen, 
  onClose 
}: FeedbackDetailsModalProps) {
  // Format date to readable string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Feedback Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">User</h3>
            <p className="mt-1 text-sm text-gray-900">
              {feedback.user?.name || 'Anonymous'} 
              {feedback.user?.email && <span className="text-gray-500 ml-1">({feedback.user.email})</span>}
            </p>
          </div>

          {/* Rating */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Rating</h3>
            <div className="mt-1">
              <StarRating rating={feedback.rating} onChange={() => {}} disabled={true} />
            </div>
          </div>

          {/* Feedback Text */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Feedback</h3>
            <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm text-gray-900">
              {feedback.feedback || <span className="text-gray-400 italic">No feedback provided</span>}
            </div>
          </div>

          {/* Feature Interests */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Feature Interests</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {feedback.featureInterest.length > 0 ? (
                feedback.featureInterest.map((feature) => (
                  <span
                    key={feature}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {feature}
                  </span>
                ))
              ) : (
                <span className="text-gray-400 italic">No features selected</span>
              )}
            </div>
          </div>

          {/* Submission Date */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Submitted On</h3>
            <p className="mt-1 text-sm text-gray-900">{formatDate(feedback.createdAt)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 