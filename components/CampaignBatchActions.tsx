import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckIcon, TrashIcon, CalendarIcon, TagIcon, ClockIcon } from 'lucide-react';
import { ItemStatus } from '@prisma/client';

import { Button } from './ui/button';
import { useToast } from './ui/use-toast';
import { CampaignItem } from '../hooks/useCampaignPlanner';

interface CampaignBatchActionsProps {
  selectedItems: CampaignItem[];
  onClearSelection: () => void;
  onUpdateStatus: (itemIds: string[], status: ItemStatus) => Promise<void>;
  onDeleteItems: (itemIds: string[]) => Promise<void>;
  onRescheduleItems?: (itemIds: string[], date: Date) => Promise<void>;
  onAddTagToItems?: (itemIds: string[], tag: string) => Promise<void>;
}

export function CampaignBatchActions({
  selectedItems,
  onClearSelection,
  onUpdateStatus,
  onDeleteItems,
  onRescheduleItems,
  onAddTagToItems
}: CampaignBatchActionsProps): React.ReactElement | null {
  const { toast } = useToast();
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  
  if (!selectedItems.length) return null;
  
  const handleUpdateStatus = async (status: ItemStatus): Promise<void> => {
    setIsActionLoading(true);
    try {
      await onUpdateStatus(
        selectedItems.map(item => item.id),
        status
      );
      toast({
        title: "Status updated",
        description: `${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''} updated to ${status.toLowerCase()}`,
        variant: "default",
      });
      onClearSelection();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update items status",
        variant: "destructive",
      });
      console.error(error);
    } finally {
      setIsActionLoading(false);
    }
  };
  
  const handleDeleteItems = async (): Promise<void> => {
    if (!confirm(`Are you sure you want to delete ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}?`)) return;
    
    setIsActionLoading(true);
    try {
      await onDeleteItems(selectedItems.map(item => item.id));
      toast({
        title: "Items deleted",
        description: `${selectedItems.length} item${selectedItems.length > 1 ? 's were' : ' was'} deleted`,
        variant: "default",
      });
      onClearSelection();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete items",
        variant: "destructive",
      });
      console.error(error);
    } finally {
      setIsActionLoading(false);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-background border shadow-lg rounded-lg px-4 py-2 z-50 flex items-center gap-2"
      style={{ maxWidth: "calc(100% - 2rem)" }}
    >
      <div className="flex-shrink-0 bg-primary text-primary-foreground px-2 py-1 rounded text-sm">
        {selectedItems.length} selected
      </div>
      
      <div className="grid grid-flow-col auto-cols-max gap-2 overflow-x-auto max-w-[calc(100vw-2rem)] pb-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleUpdateStatus(ItemStatus.SCHEDULED)}
          disabled={isActionLoading}
          className="whitespace-nowrap"
        >
          <ClockIcon className="mr-1 h-3 w-3" />
          Mark Scheduled
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleUpdateStatus(ItemStatus.ACTIVE)}
          disabled={isActionLoading}
          className="whitespace-nowrap"
        >
          <ClockIcon className="mr-1 h-3 w-3" />
          Mark Active
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleUpdateStatus(ItemStatus.COMPLETED)}
          disabled={isActionLoading}
          className="whitespace-nowrap"
        >
          <CheckIcon className="mr-1 h-3 w-3" />
          Mark Completed
        </Button>
        
        {onRescheduleItems && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const date = prompt('Enter new date (YYYY-MM-DD):');
              if (date) {
                const newDate = new Date(date);
                if (isNaN(newDate.getTime())) {
                  toast({
                    title: "Invalid date",
                    description: "Please enter a valid date in YYYY-MM-DD format",
                    variant: "destructive",
                  });
                  return;
                }
                
                setIsActionLoading(true);
                onRescheduleItems(selectedItems.map(item => item.id), newDate)
                  .then(() => {
                    toast({
                      title: "Items rescheduled",
                      description: `${selectedItems.length} item${selectedItems.length > 1 ? 's were' : ' was'} rescheduled`,
                      variant: "default",
                    });
                    onClearSelection();
                  })
                  .catch((error) => {
                    toast({
                      title: "Error",
                      description: "Failed to reschedule items",
                      variant: "destructive",
                    });
                    console.error(error);
                  })
                  .finally(() => {
                    setIsActionLoading(false);
                  });
              }
            }}
            disabled={isActionLoading}
            className="whitespace-nowrap"
          >
            <CalendarIcon className="mr-1 h-3 w-3" />
            Reschedule
          </Button>
        )}
        
        {onAddTagToItems && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const tag = prompt('Enter tag to add:');
              if (tag && tag.trim()) {
                setIsActionLoading(true);
                onAddTagToItems(selectedItems.map(item => item.id), tag.trim())
                  .then(() => {
                    toast({
                      title: "Tag added",
                      description: `Tag "${tag.trim()}" added to ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}`,
                      variant: "default",
                    });
                    onClearSelection();
                  })
                  .catch((error) => {
                    toast({
                      title: "Error",
                      description: "Failed to add tag to items",
                      variant: "destructive",
                    });
                    console.error(error);
                  })
                  .finally(() => {
                    setIsActionLoading(false);
                  });
              }
            }}
            disabled={isActionLoading}
            className="whitespace-nowrap"
          >
            <TagIcon className="mr-1 h-3 w-3" />
            Add Tag
          </Button>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleDeleteItems}
          disabled={isActionLoading}
          className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border-red-200 whitespace-nowrap"
        >
          <TrashIcon className="mr-1 h-3 w-3" />
          Delete
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={isActionLoading}
          className="whitespace-nowrap"
        >
          Cancel
        </Button>
      </div>
    </motion.div>
  );
} 