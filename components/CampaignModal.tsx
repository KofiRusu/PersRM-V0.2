import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarIcon, Loader2, XCircle, TagIcon, Info } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

import { CampaignStatus } from '@prisma/client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form';

import { Input } from './ui/input';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Calendar } from './ui/calendar';
import { useToast } from './ui/use-toast';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';

// Define validation schema for form
const formSchema = z.object({
  name: z.string().min(1, { message: 'Campaign name is required' }),
  description: z.string().optional(),
  status: z.nativeEnum(CampaignStatus, {
    required_error: 'Please select a status',
  }).default(CampaignStatus.DRAFT),
  tags: z.string().optional(),
  startDate: z.date({
    required_error: 'Start date is required',
  }),
  endDate: z.date({
    required_error: 'End date is required',
  }).optional(),
  isPublic: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  tags: string[];
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  isPublic?: boolean;
}

interface CampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>;
  initialData?: Partial<Campaign>;
  isEdit?: boolean;
}

export function CampaignModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEdit = false,
}: CampaignModalProps): React.ReactElement {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      status: initialData?.status || CampaignStatus.DRAFT,
      tags: initialData?.tags ? initialData.tags.join(', ') : '',
      startDate: initialData?.startDate ? new Date(initialData.startDate) : new Date(),
      endDate: initialData?.endDate ? new Date(initialData.endDate) : undefined,
      isPublic: initialData?.isPublic || false,
    },
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: initialData?.name || '',
        description: initialData?.description || '',
        status: initialData?.status || CampaignStatus.DRAFT,
        tags: initialData?.tags ? initialData.tags.join(', ') : '',
        startDate: initialData?.startDate ? new Date(initialData.startDate) : new Date(),
        endDate: initialData?.endDate ? new Date(initialData.endDate) : undefined,
        isPublic: initialData?.isPublic || false,
      });
      setError(null);
    }
  }, [initialData, isOpen, form]);

  // Handle form submission
  const handleSubmit = async (values: FormValues): Promise<void> => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Transform form values to campaign format
      const campaign = {
        name: values.name,
        description: values.description,
        status: values.status,
        tags: values.tags ? values.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
        startDate: values.startDate,
        endDate: values.endDate,
        isPublic: values.isPublic,
      };

      await onSubmit(campaign);
      toast({
        title: isEdit ? "Campaign updated" : "Campaign created",
        description: isEdit 
          ? "The campaign has been updated successfully" 
          : "A new campaign has been created",
        variant: "default",
      });
      onClose();
    } catch (error) {
      console.error('Error submitting campaign:', error);
      setError(error instanceof Error ? error.message : 'Failed to save campaign');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save campaign',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: CampaignStatus): string => {
    switch (status) {
      case CampaignStatus.ACTIVE: return 'bg-green-100 text-green-800';
      case CampaignStatus.COMPLETED: return 'bg-blue-100 text-blue-800';
      case CampaignStatus.DRAFT: return 'bg-orange-100 text-orange-800';
      case CampaignStatus.ARCHIVED: return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-[550px] overflow-hidden"
        aria-labelledby="campaign-title"
        aria-describedby="campaign-description"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader>
            <DialogTitle id="campaign-title">
              {isEdit ? 'Edit Campaign' : 'Create Campaign'}
            </DialogTitle>
            <DialogDescription id="campaign-description">
              {isEdit
                ? 'Edit the details of your campaign'
                : 'Create a new campaign to organize your marketing efforts'}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm flex items-start"
              role="alert"
            >
              <XCircle className="h-5 w-5 mr-2 flex-shrink-0 text-red-500" />
              <span>{error}</span>
            </motion.div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campaign Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter campaign name" 
                        {...field} 
                        autoFocus
                        aria-required="true"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
                      <Button
                        variant={"outline"}
                        className={`w-full justify-start text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                        type="button"
                        onClick={(e) => e.preventDefault()}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date (Optional)</FormLabel>
                      <Button
                        variant={"outline"}
                        className={`w-full justify-start text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                        type="button"
                        onClick={(e) => e.preventDefault()}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date(form.watch('startDate'))}
                        initialFocus
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(CampaignStatus).map(status => (
                          <SelectItem key={status} value={status} className="flex items-center">
                            <div className="flex items-center">
                              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getStatusColor(status).split(' ')[0]}`}></span>
                              <span>{status}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter campaign description"
                        className="min-h-[100px] resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <TagIcon className="h-4 w-4 mr-1" />
                      Tags (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter tags separated by commas"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Separate tags with commas (e.g., "social, marketing, Q2")
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Make this campaign public
                      </FormLabel>
                      <FormDescription>
                        Public campaigns can be viewed by all team members
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4 gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="min-w-[100px] transition-all"
                >
                  {isSubmitting ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center"
                    >
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </motion.div>
                  ) : isEdit ? (
                    'Update Campaign'
                  ) : (
                    'Create Campaign'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
} 