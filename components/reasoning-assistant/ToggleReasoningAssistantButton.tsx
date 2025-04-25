import React from 'react';
import { useReasoningAssistant } from './ReasoningAssistantProvider';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Brain } from 'lucide-react';

// Define variants with class-variance-authority
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ToggleReasoningAssistantButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const ToggleReasoningAssistantButton: React.FC<ToggleReasoningAssistantButtonProps> = ({
  className,
  variant = "outline",
  size = "icon",
  ...props
}) => {
  const { isOpen, toggleAssistant } = useReasoningAssistant();

  const handleToggle = () => {
    toggleAssistant('button');
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(buttonVariants({ variant, size }), className)}
      aria-label={isOpen ? "Close Reasoning Assistant" : "Open Reasoning Assistant"}
      aria-pressed={isOpen}
      type="button"
      {...props}
    >
      <Brain className={cn(
        "h-5 w-5 transition-all",
        isOpen && "text-primary animate-pulse"
      )} />
    </button>
  );
};

export default ToggleReasoningAssistantButton; 