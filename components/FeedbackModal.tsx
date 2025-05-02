import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Button,
  Checkbox
} from '@/components/ui';
import { StarRating } from '@/components/StarRating';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { submitBetaFeedback, FeedbackData } from '@/lib/db/betaFeedback';

interface FeedbackFeature {
  id: string;
  label: string;
}

const FEATURES: FeedbackFeature[] = [
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'automation', label: 'Automation' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'reporting', label: 'Reporting' }
];

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export function FeedbackModal({ isOpen, onClose, userId }: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFeatureToggle = (featureId: string) => {
    setSelectedFeatures(prev => 
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  const resetForm = () => {
    setRating(0);
    setFeedback('');
    setSelectedFeatures([]);
    setError(null);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      // Only reset the form after animation completes
      setTimeout(resetForm, 300);
    }
  };

  const handleSubmit = async () => {
    // Validate form
    if (rating === 0) {
      setError('Please provide a rating');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const feedbackData: FeedbackData = {
        rating,
        feedback: feedback || undefined,
        featureInterest: selectedFeatures,
        userId
      };

      const result = await submitBetaFeedback(feedbackData);

      if (result.success) {
        setIsSuccess(true);
        // Close modal after showing success for a moment
        setTimeout(() => {
          handleClose();
          setIsSuccess(false);
        }, 2000);
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error('Error submitting feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={isSubmitting ? undefined : handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Beta Feedback</DialogTitle>
          <DialogDescription>
            Help us improve OFAuto by sharing your experience with the beta
          </DialogDescription>
        </DialogHeader>

        {!isSuccess ? (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">How would you rate your experience?</label>
              <div className="flex justify-center py-2">
                <StarRating rating={rating} onChange={setRating} disabled={isSubmitting} />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="feedback" className="text-sm font-medium">
                What could we improve? (optional)
              </label>
              <textarea
                id="feedback"
                className="w-full min-h-[100px] px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Share your thoughts..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">
                Which features are you most interested in?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FEATURES.map((feature) => (
                  <div className="flex items-center space-x-2" key={feature.id}>
                    <Checkbox 
                      id={`feature-${feature.id}`}
                      checked={selectedFeatures.includes(feature.id)}
                      onCheckedChange={() => handleFeatureToggle(feature.id)}
                      disabled={isSubmitting}
                    />
                    <label 
                      htmlFor={`feature-${feature.id}`}
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {feature.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-500">{error}</div>
            )}
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center space-y-2">
            <CheckCircle2 className="text-green-500 h-12 w-12" />
            <p className="text-center font-medium">Thank you for your feedback!</p>
          </div>
        )}

        <DialogFooter>
          {!isSuccess && (
            <>
              <Button 
                variant="outline" 
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 