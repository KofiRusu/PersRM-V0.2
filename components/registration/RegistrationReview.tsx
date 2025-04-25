import React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Edit,
  Mail,
  User,
  Shield,
  UserCog,
  Clock,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Define validation schema
const formSchema = z.object({
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms and conditions" }),
  }),
  marketingOptIn: z.boolean().optional(),
});

// Type for form values
type FormValues = z.infer<typeof formSchema>;

// User data type representing all the collected registration information
interface UserRegistrationData {
  email: string;
  firstName: string;
  lastName: string;
  timezone: string;
  bio?: string;
  avatarUrl?: string;
  role: "admin" | "user" | "guest";
}

// Props for the component
interface RegistrationReviewProps {
  userData: UserRegistrationData;
  onComplete: (data: { termsAccepted: boolean; marketingOptIn: boolean }) => void;
  onBack: () => void;
  onEdit: (step: number) => void;
  isLoading?: boolean;
}

// Role display configuration
const roleConfig = {
  admin: {
    label: "Administrator",
    icon: Shield,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  user: {
    label: "Standard User",
    icon: UserCog,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  guest: {
    label: "Guest",
    icon: User,
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  },
};

export function RegistrationReview({
  userData,
  onComplete,
  onBack,
  onEdit,
  isLoading = false,
}: RegistrationReviewProps) {
  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      termsAccepted: false,
      marketingOptIn: false,
    },
  });

  // Handle form submission
  const onSubmit = (values: FormValues) => {
    onComplete({
      termsAccepted: values.termsAccepted,
      marketingOptIn: !!values.marketingOptIn,
    });
  };

  // Format timezone for display
  const formatTimezone = (timezone: string): string => {
    return timezone.replace(/_/g, " ").replace(/\//g, " / ");
  };

  // Get initials for avatar fallback
  const getInitials = (): string => {
    return (
      (userData.firstName?.charAt(0) || "") +
      (userData.lastName?.charAt(0) || "")
    ).toUpperCase();
  };

  const RoleIcon = roleConfig[userData.role].icon;

  return (
    <div className="space-y-6 max-w-md w-full mx-auto p-4 sm:p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Review your information</h1>
        <p className="text-muted-foreground">
          Please confirm your details before completing registration
        </p>
      </div>

      {/* User Information Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle>Account Details</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => onEdit(0)}
              disabled={isLoading}
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{userData.email}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 ml-7">
            Your account email and login
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle>Profile Information</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => onEdit(1)}
              disabled={isLoading}
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border border-muted">
              <AvatarImage src={userData.avatarUrl} alt="Profile" />
              <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-lg">
                {userData.firstName} {userData.lastName}
              </h3>
              <div className="flex items-center text-sm text-muted-foreground mt-1">
                <Clock className="h-3.5 w-3.5 mr-1" />
                {formatTimezone(userData.timezone)}
              </div>
            </div>
          </div>

          {userData.bio && (
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">About</span>
              </div>
              <p className="text-sm text-muted-foreground ml-6">{userData.bio}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle>Role</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => onEdit(2)}
              disabled={isLoading}
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "px-3 py-1 flex items-center gap-2",
                roleConfig[userData.role].color
              )}
            >
              <RoleIcon className="h-3.5 w-3.5" />
              <span>{roleConfig[userData.role].label}</span>
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="termsAccepted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Accept Terms & Conditions</FormLabel>
                    <FormDescription>
                      I agree to the{" "}
                      <a
                        href="/terms"
                        className="text-primary underline underline-offset-2"
                        target="_blank"
                        rel="noreferrer"
                      >
                        terms of service
                      </a>{" "}
                      and{" "}
                      <a
                        href="/privacy"
                        className="text-primary underline underline-offset-2"
                        target="_blank"
                        rel="noreferrer"
                      >
                        privacy policy
                      </a>
                      .
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="marketingOptIn"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Marketing Communications (Optional)</FormLabel>
                    <FormDescription>
                      I agree to receive updates, newsletters, and promotional emails.
                      You can unsubscribe at any time.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <FormMessage className="text-center" />

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              type="submit"
              className="w-full sm:flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                "Processing..."
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Complete Registration
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
} 