import React from 'react';
import { useTheme, useThemeValue } from '@/theme';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { X, AlertCircle, Info, CheckCircle } from 'lucide-react';

// Define variants with class-variance-authority
const alertVariants = cva(
  "relative w-full rounded-md border p-4 [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:h-5 [&>svg]:w-5",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        success: "border-success/50 text-success-foreground dark:border-success [&>svg]:text-success",
        warning: "border-warning/50 text-warning-foreground dark:border-warning [&>svg]:text-warning",
        info: "border-primary/50 text-primary-foreground dark:border-primary [&>svg]:text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

// Icon mapping
const iconMap = {
  default: Info,
  destructive: AlertCircle,
  success: CheckCircle,
  info: Info,
  warning: AlertCircle,
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** The title of the alert */
  title?: string;
  /** The description of the alert */
  description?: React.ReactNode;
  /** Whether to show the close button */
  dismissible?: boolean;
  /** Callback when the alert is dismissed */
  onDismiss?: () => void;
  /** The icon to display (or false to hide icon) */
  icon?: React.ReactNode | false;
}

export function Alert({
  className,
  variant = "default",
  title,
  description,
  dismissible = false,
  onDismiss,
  icon,
  children,
  ...props
}: AlertProps) {
  // Use the theme
  const { theme } = useTheme();
  
  // Get the icon component based on variant
  const IconComponent = iconMap[variant as keyof typeof iconMap] || Info;
  const iconToRender = icon === undefined ? <IconComponent /> : icon;

  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {iconToRender}
      <div className="flex flex-col gap-1">
        {title && <h5 className="font-medium leading-none tracking-tight">{title}</h5>}
        {description && <div className="text-sm [&_p]:leading-relaxed">{description}</div>}
        {children}
      </div>
      {dismissible && (
        <button 
          onClick={onDismiss} 
          className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close alert"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
    </div>
  );
}

// Alert title component
export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  );
}

// Alert description component
export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div
      className={cn("text-sm [&_p]:leading-relaxed", className)}
      {...props}
    />
  );
}

// Example usage:
export function AlertExample() {
  return (
    <div className="space-y-4">
      <Alert variant="default" title="Default Alert" description="This is a default alert." />
      <Alert 
        variant="destructive" 
        title="Error!" 
        description="Your action couldn't be completed." 
        dismissible 
        onDismiss={() => console.log('Alert dismissed')} 
      />
      <Alert variant="success" title="Success!" description="Your action was completed successfully." />
      <Alert variant="warning" title="Warning" description="This action might have consequences." />
      <Alert variant="info" title="Information" description="Here's some information you should know." />
    </div>
  );
} 