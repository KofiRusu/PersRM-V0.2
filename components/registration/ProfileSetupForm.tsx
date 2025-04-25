import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  User, 
  Clock, 
  FileUp, 
  X,
  Loader2
} from "lucide-react";

// Define validation schema
const formSchema = z.object({
  firstName: z
    .string()
    .min(1, { message: "First name is required" })
    .max(50, { message: "First name cannot exceed 50 characters" }),
  lastName: z
    .string()
    .min(1, { message: "Last name is required" })
    .max(50, { message: "Last name cannot exceed 50 characters" }),
  timezone: z.string().min(1, { message: "Timezone is required" }),
  bio: z
    .string()
    .max(500, { message: "Bio cannot exceed 500 characters" })
    .optional(),
  // Avatar file is handled separately since it's a file upload
});

// Type for form values
type FormValues = z.infer<typeof formSchema>;

// Props for the component
interface ProfileSetupFormProps {
  onNext: (data: {
    firstName: string;
    lastName: string;
    timezone: string;
    bio?: string;
    avatarUrl?: string;
  }) => void;
  onBack: () => void;
  defaultValues?: {
    firstName?: string;
    lastName?: string;
    timezone?: string;
    bio?: string;
    avatarUrl?: string;
  };
  isLoading?: boolean;
}

// List of common timezones for the dropdown
const commonTimezones = [
  { value: "America/New_York", label: "(GMT-5) Eastern Time - New York" },
  { value: "America/Chicago", label: "(GMT-6) Central Time - Chicago" },
  { value: "America/Denver", label: "(GMT-7) Mountain Time - Denver" },
  { value: "America/Los_Angeles", label: "(GMT-8) Pacific Time - Los Angeles" },
  { value: "America/Anchorage", label: "(GMT-9) Alaska Time - Anchorage" },
  { value: "Pacific/Honolulu", label: "(GMT-10) Hawaii Time - Honolulu" },
  { value: "Europe/London", label: "(GMT+0) Greenwich Mean Time - London" },
  { value: "Europe/Paris", label: "(GMT+1) Central European Time - Paris" },
  { value: "Europe/Athens", label: "(GMT+2) Eastern European Time - Athens" },
  { value: "Asia/Dubai", label: "(GMT+4) Gulf Standard Time - Dubai" },
  { value: "Asia/Singapore", label: "(GMT+8) Singapore Time" },
  { value: "Asia/Tokyo", label: "(GMT+9) Japan Standard Time - Tokyo" },
  { value: "Australia/Sydney", label: "(GMT+10) Eastern Australia Time - Sydney" },
];

// Get user's local timezone
const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return "America/New_York"; // Default fallback
  }
};

export function ProfileSetupForm({
  onNext,
  onBack,
  defaultValues = {},
  isLoading = false,
}: ProfileSetupFormProps) {
  // State for avatar handling
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    defaultValues.avatarUrl
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Initialize form with defaults and user's timezone
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: defaultValues.firstName || "",
      lastName: defaultValues.lastName || "",
      timezone: defaultValues.timezone || getUserTimezone(),
      bio: defaultValues.bio || "",
    },
  });

  // Handle form submission
  const onSubmit = (values: FormValues) => {
    onNext({
      firstName: values.firstName,
      lastName: values.lastName,
      timezone: values.timezone,
      bio: values.bio,
      avatarUrl,
    });
  };

  // Handle avatar upload
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // File type validation
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file");
      return;
    }
    
    // File size validation (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image size should be less than 5MB");
      return;
    }
    
    setAvatarFile(file);
    setUploadError(null);
    
    // In a real app, this would upload to a server
    // Simulating upload for demo purposes
    setIsUploading(true);
    setTimeout(() => {
      const objectUrl = URL.createObjectURL(file);
      setAvatarUrl(objectUrl);
      setIsUploading(false);
    }, 1500);
  };

  // Remove the avatar
  const removeAvatar = () => {
    setAvatarUrl(undefined);
    setAvatarFile(null);
    setUploadError(null);
  };

  // Get initials for avatar fallback
  const getInitials = (): string => {
    const firstName = form.watch("firstName") || "";
    const lastName = form.watch("lastName") || "";
    return firstName.charAt(0) + lastName.charAt(0);
  };

  return (
    <div className="space-y-6 max-w-md w-full mx-auto p-4 sm:p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Set up your profile</h1>
        <p className="text-muted-foreground">
          Tell us a bit about yourself
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-muted">
                {isUploading ? (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <AvatarImage src={avatarUrl} alt="Profile picture" />
                    <AvatarFallback className="text-2xl font-semibold bg-primary text-primary-foreground">
                      {getInitials() || <User className="h-12 w-12" />}
                    </AvatarFallback>
                  </>
                )}
              </Avatar>
              
              {avatarUrl && !isUploading && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
                  onClick={removeAvatar}
                  aria-label="Remove profile picture"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            <div className="text-center">
              <label
                htmlFor="avatar-upload"
                className={`
                  cursor-pointer inline-flex items-center px-4 py-2 rounded-md
                  ${isUploading ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}
                  text-sm font-medium transition-colors
                `}
              >
                <FileUp className="mr-2 h-4 w-4" />
                {avatarUrl ? "Change picture" : "Upload picture"}
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleAvatarChange}
                  disabled={isUploading || isLoading}
                />
              </label>
              
              {uploadError && (
                <p className="mt-2 text-sm text-destructive">{uploadError}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                JPEG, PNG or GIF, max 5MB
              </p>
            </div>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="John" 
                      {...field} 
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Doe" 
                      {...field} 
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Timezone selection */}
          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="pl-10">
                        <SelectValue placeholder="Select your timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {commonTimezones.map((timezone) => (
                          <SelectItem
                            key={timezone.value}
                            value={timezone.value}
                          >
                            {timezone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </FormControl>
                <FormDescription>
                  This helps us display times in your local timezone
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Bio / About */}
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center">
                  <FormLabel>About you (optional)</FormLabel>
                  <span className="text-xs text-muted-foreground">
                    {field.value?.length || 0}/500
                  </span>
                </div>
                <FormControl>
                  <Textarea
                    placeholder="Tell us a bit about yourself..."
                    rows={4}
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  Brief introduction or bio that others will see on your profile
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Navigation buttons */}
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
              disabled={isLoading || isUploading}
            >
              {isLoading ? "Please wait..." : "Continue"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
} 