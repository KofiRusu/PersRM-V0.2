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
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Shield, User, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

// Define validation schema
const formSchema = z.object({
  role: z.enum(["admin", "user", "guest"], {
    required_error: "Please select a role",
  }),
});

// Type for form values
type FormValues = z.infer<typeof formSchema>;

// Props for the component
interface RoleSelectionFormProps {
  onNext: (data: { role: "admin" | "user" | "guest" }) => void;
  onBack: () => void;
  defaultValues?: {
    role?: "admin" | "user" | "guest";
  };
  isLoading?: boolean;
}

// Role information
const roles = [
  {
    id: "admin",
    name: "Administrator",
    description:
      "Full access to all features and settings. Can manage users, content, and system configuration.",
    icon: Shield,
    color: "border-purple-200 bg-purple-50 data-[state=checked]:border-purple-700 dark:border-purple-800/30 dark:bg-purple-900/20 dark:data-[state=checked]:border-purple-700",
    iconColor: "text-purple-700 dark:text-purple-500",
  },
  {
    id: "user",
    name: "Standard User",
    description:
      "Regular access to core features. Can manage personal content and collaborate with others.",
    icon: UserCog, 
    color: "border-blue-200 bg-blue-50 data-[state=checked]:border-blue-700 dark:border-blue-800/30 dark:bg-blue-900/20 dark:data-[state=checked]:border-blue-700",
    iconColor: "text-blue-700 dark:text-blue-500",
  },
  {
    id: "guest",
    name: "Guest",
    description:
      "Limited access to view-only features. Cannot create content or modify settings.",
    icon: User,
    color: "border-gray-200 bg-gray-50 data-[state=checked]:border-gray-700 dark:border-gray-800/30 dark:bg-gray-900/20 dark:data-[state=checked]:border-gray-700",
    iconColor: "text-gray-700 dark:text-gray-500",
  },
];

export function RoleSelectionForm({
  onNext,
  onBack,
  defaultValues = {},
  isLoading = false,
}: RoleSelectionFormProps) {
  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: defaultValues.role || "user", // Default to user role
    },
  });

  // Handle form submission
  const onSubmit = (values: FormValues) => {
    onNext({ role: values.role });
  };

  return (
    <div className="space-y-6 max-w-md w-full mx-auto p-4 sm:p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Select your role</h1>
        <p className="text-muted-foreground">
          Choose the role that best fits your needs
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="space-y-3"
                    disabled={isLoading}
                  >
                    {roles.map((role) => {
                      const Icon = role.icon;
                      return (
                        <FormItem
                          key={role.id}
                          className="flex"
                        >
                          <FormControl>
                            <RadioGroupItem
                              value={role.id}
                              id={role.id}
                              className="sr-only peer"
                              aria-labelledby={`${role.id}-label`}
                            />
                          </FormControl>
                          <label
                            htmlFor={role.id}
                            id={`${role.id}-label`}
                            className={cn(
                              "flex flex-1 cursor-pointer items-start space-x-4 rounded-md border-2 p-4",
                              "transition-all hover:bg-accent peer-data-[state=checked]:border-primary",
                              role.color
                            )}
                          >
                            <div className={cn("shrink-0 mt-1", role.iconColor)}>
                              <Icon className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {role.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {role.description}
                              </p>
                            </div>
                          </label>
                        </FormItem>
                      );
                    })}
                  </RadioGroup>
                </FormControl>
                <FormDescription>
                  You can change your role later in profile settings
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

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
              {isLoading ? "Please wait..." : "Continue"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
} 