import { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  onChange: (rating: number) => void;
  size?: number;
  disabled?: boolean;
}

export function StarRating({ 
  rating, 
  onChange, 
  size = 24,
  disabled = false 
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !disabled && onChange(star)}
          onMouseEnter={() => !disabled && setHoverRating(star)}
          onMouseLeave={() => !disabled && setHoverRating(0)}
          disabled={disabled}
          className={`transition-colors focus:outline-none ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
          aria-label={`Rate ${star} stars out of 5`}
        >
          <Star
            size={size}
            className={`transition-colors ${
              star <= (hoverRating || rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
} 