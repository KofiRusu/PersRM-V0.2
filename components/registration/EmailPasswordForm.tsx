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
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Lock, AlertCircle, EyeIcon, EyeOffIcon } from "lucide-react";

// Define validation schema
const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Must be a valid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" })
    .regex(/[^A-Za-z0-9]/, { message: "Password must contain at least one special character" }),
  confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Type for the form values
type FormValues = z.infer<typeof formSchema>;

// Props for the component
interface EmailPasswordFormProps {
  onNext: (data: { email: string; password: string }) => void;
  defaultValues?: {
    email?: string;
    password?: string;
  };
  isLoading?: boolean;
}

export function EmailPasswordForm({
  onNext,
  defaultValues = {},
  isLoading = false,
}: EmailPasswordFormProps) {
  // State for password visibility and strength
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Initialize the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: defaultValues.email || "",
      password: defaultValues.password || "",
      confirmPassword: defaultValues.password || "",
    },
  });

  // Function to calculate password strength
  const calculatePasswordStrength = (password: string): number => {
    if (!password) return 0;
    
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength += 25;
    
    // Complexity checks
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 12.5;
    if (/[^A-Za-z0-9]/.test(password)) strength += 12.5;
    
    return Math.min(100, strength);
  };

  // Handle password input to calculate strength
  const handlePasswordInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStrength = calculatePasswordStrength(e.target.value);
    setPasswordStrength(newStrength);
    form.setValue("password", e.target.value);
  };

  // Handle form submission
  const onSubmit = (values: FormValues) => {
    onNext({ email: values.email, password: values.password });
  };

  // Get strength color and label
  const getStrengthColor = (strength: number): string => {
    if (strength < 30) return "bg-destructive";
    if (strength < 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getStrengthLabel = (strength: number): string => {
    if (strength < 30) return "Weak";
    if (strength < 70) return "Moderate";
    return "Strong";
  };

  return (
    <div className="space-y-6 max-w-md w-full mx-auto p-4 sm:p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground">
          Enter your email and create a secure password
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="name@example.com" 
                      className="pl-10"
                      {...field}
                      type="email"
                      autoComplete="email"
                      disabled={isLoading}
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  We'll send a verification link to this email
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Create a password"
                      className="pl-10 pr-10"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      disabled={isLoading}
                      {...field}
                      onChange={handlePasswordInput}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOffIcon className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <EyeIcon className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Password strength: {getStrengthLabel(passwordStrength)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {passwordStrength}%
                    </span>
                  </div>
                  <Progress 
                    value={passwordStrength} 
                    className={getStrengthColor(passwordStrength)}
                    aria-label="Password strength indicator"
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Confirm your password"
                      className="pl-10 pr-10"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      disabled={isLoading}
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOffIcon className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <EyeIcon className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Alert variant="outline" className="border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-400">
              Your password should be at least 8 characters and include uppercase, lowercase, number and special characters.
            </AlertDescription>
          </Alert>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? "Please wait..." : "Continue"}
          </Button>
        </form>
      </Form>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="underline underline-offset-4 hover:text-primary">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
} 