import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarIcon, Loader2, XCircle, TagIcon, Info } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

import { CampaignItem, CampaignItemType, ItemStatus } from '@prisma/client';

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Calendar } from './ui/calendar';
import { useToast } from './ui/use-toast';

// Define validation schema for form
const formSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }),
  type: z.nativeEnum(CampaignItemType, {
    required_error: 'Please select a type',
  }),
  scheduledAt: z.date({
    required_error: 'Scheduled date is required',
  }),
  description: z.string().optional(),
  status: z.nativeEnum(ItemStatus, {
    required_error: 'Please select a status',
  }).default(ItemStatus.SCHEDULED),
  tags: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CampaignItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: Omit<CampaignItem, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'campaignId'>) => Promise<void>;
  initialData?: Partial<CampaignItem>;
  campaignId: string;
  isEdit?: boolean;
}

export function CampaignItemModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  campaignId,
  isEdit = false,
}: CampaignItemModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || '',
      type: initialData?.type || CampaignItemType.TASK,
      scheduledAt: initialData?.scheduledAt ? new Date(initialData.scheduledAt) : new Date(),
      description: initialData?.description || '',
      status: initialData?.status || ItemStatus.SCHEDULED,
      tags: initialData?.tags ? initialData.tags.join(', ') : '',
    },
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: initialData?.title || '',
        type: initialData?.type || CampaignItemType.TASK,
        scheduledAt: initialData?.scheduledAt ? new Date(initialData.scheduledAt) : new Date(),
        description: initialData?.description || '',
        status: initialData?.status || ItemStatus.SCHEDULED,
        tags: initialData?.tags ? initialData.tags.join(', ') : '',
      });
      setError(null);
    }
  }, [initialData, isOpen, form]);

  // Handle form submission
  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Transform form values to campaignItem format
      const campaignItem = {
        title: values.title,
        type: values.type,
        scheduledAt: values.scheduledAt,
        description: values.description,
        status: values.status,
        tags: values.tags ? values.tags.split(',').map(tag => tag.trim()) : [],
      };

      await onSubmit(campaignItem);
      toast({
        title: isEdit ? "Item updated" : "Item created",
        description: isEdit 
          ? "The campaign item has been updated successfully" 
          : "A new campaign item has been created",
        variant: "default",
      });
      onClose();
    } catch (error) {
      console.error('Error submitting campaign item:', error);
      setError(error instanceof Error ? error.message : 'Failed to save campaign item');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save campaign item',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeIcon = (type: CampaignItemType) => {
    switch (type) {
      case CampaignItemType.POST: return '📱';
      case CampaignItemType.EMAIL: return '📧';
      case CampaignItemType.DM: return '💬';
      case CampaignItemType.EXPERIMENT: return '🧪';
      case CampaignItemType.TASK: return '✅';
      default: return '📋';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-[500px] overflow-hidden"
        aria-labelledby="campaign-item-title"
        aria-describedby="campaign-item-description"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader>
            <DialogTitle id="campaign-item-title">
              {isEdit ? 'Edit Campaign Item' : 'Create Campaign Item'}
            </DialogTitle>
            <DialogDescription id="campaign-item-description">
              {isEdit
                ? 'Edit the details of your campaign item'
                : 'Add a new item to your campaign'}
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
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter title" 
                        {...field}
                        autoFocus
                        aria-required="true"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(CampaignItemType).map(type => (
                          <SelectItem key={type} value={type} className="flex items-center">
                            <span className="mr-2">{getTypeIcon(type)}</span> {type}
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
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Scheduled Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={`w-full pl-3 text-left font-normal transition-all ${
                              !field.value ? 'text-muted-foreground' : ''
                            }`}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEdit && (
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
                          <SelectItem value={ItemStatus.SCHEDULED}>Scheduled</SelectItem>
                          <SelectItem value={ItemStatus.ACTIVE}>Active</SelectItem>
                          <SelectItem value={ItemStatus.COMPLETED}>Completed</SelectItem>
                          <SelectItem value={ItemStatus.FAILED}>Failed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter description"
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
                    'Update Item'
                  ) : (
                    'Create Item'
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