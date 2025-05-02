import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import { CampaignItem, Campaign } from '@/hooks/useCampaignPlanner';
import { useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';
import { ItemStatus, CampaignItemType } from '@prisma/client';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Badge, Box, Flex, Text, Heading } from '@chakra-ui/react';
import { useCampaignPlanner } from '../hooks/useCampaignPlanner';
import { CampaignItemModal } from './CampaignItemModal';
import { Button } from './ui/button';
import { PlusCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from './ui/use-toast';

// Setup the localizer for react-big-calendar
const localizer = momentLocalizer(moment);

interface CampaignCalendarProps {
  campaign: Campaign;
  onRescheduleItem: (itemId: string, scheduledAt: Date) => Promise<void>;
  onUpdateItemStatus: (itemId: string, status: ItemStatus) => Promise<void>;
  onEditItem?: (item: CampaignItem) => void;
}

// Custom Item Component for the Calendar
interface ItemProps {
  event: {
    id: string;
    title: string;
    type: CampaignItemType;
    status: ItemStatus;
    start: Date;
    end: Date;
    resource: CampaignItem;
  };
  onReschedule: (itemId: string, scheduledAt: Date) => Promise<void>;
}

const ItemComponent: React.FC<ItemProps> = ({ event, onReschedule }) => {
  // Set up drag source
  const [{ isDragging }, drag] = useDrag({
    type: 'CALENDAR_ITEM',
    item: { id: event.id, type: event.type, originalStart: event.start },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  // Visual styling based on item type and status
  const getItemStyle = () => {
    const baseStyle = 'p-2 rounded-md text-sm overflow-hidden h-full shadow-sm border';
    const typeColors = {
      POST: 'bg-blue-100 border-blue-300 text-blue-800',
      DM: 'bg-purple-100 border-purple-300 text-purple-800',
      EMAIL: 'bg-green-100 border-green-300 text-green-800',
      EXPERIMENT: 'bg-yellow-100 border-yellow-300 text-yellow-800',
      TASK: 'bg-gray-100 border-gray-300 text-gray-800',
    };

    const statusModifier = {
      SCHEDULED: 'opacity-100',
      ACTIVE: 'opacity-100 border-l-4 border-l-amber-500',
      COMPLETED: 'opacity-80',
      FAILED: 'opacity-75 border-l-4 border-l-red-500',
    };

    const colorClass = typeColors[event.type] || typeColors.TASK;
    const statusClass = statusModifier[event.status] || statusModifier.SCHEDULED;

    return `${baseStyle} ${colorClass} ${statusClass} ${isDragging ? 'opacity-40 shadow-md' : ''}`;
  };

  // Get icon for item type
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
    <div 
      ref={drag}
      className={getItemStyle()}
      style={{ cursor: 'move' }}
      aria-label={`Draggable item: ${event.title}, type: ${event.type}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="font-medium truncate">{event.title}</div>
          <div className="text-xs flex items-center gap-1 mt-1">
            <span>{getTypeIcon(event.type)}</span>
            <span>{event.type}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Calendar Component
export function CampaignCalendar({
  campaign,
  onRescheduleItem,
  onUpdateItemStatus,
  onEditItem
}: CampaignCalendarProps) {
  const [view, setView] = useState<string>(Views.WEEK);
  const [date, setDate] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CampaignItem | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const { createItem, isLoading: isDataLoading } = useCampaignPlanner();

  // Format campaign items for the calendar
  const events = useMemo(() => {
    if (!campaign || !campaign.items) return [];

    return campaign.items
      .filter(item => item.scheduledAt) // Only show items that have a scheduled date
      .map(item => {
        const start = new Date(item.scheduledAt as Date);
        
        // For events, we need an end time. If not provided, default to 1 hour later
        const end = new Date(start);
        end.setHours(end.getHours() + 1);
        
        return {
          id: item.id,
          title: item.title,
          type: item.type,
          status: item.status,
          start,
          end,
          resource: item, // Store the full item for reference
        };
      });
  }, [campaign]);

  // Set up drop target for calendar cells
  const [, drop] = useDrop({
    accept: 'CALENDAR_ITEM',
    drop: (item: { id: string }, monitor) => {
      // Get the drop location
      const dropResult = monitor.getDropResult();
      
      // If no specific drop result (like from the calendar's built-in handlers),
      // we don't do anything here - the onEventDrop will handle it
      if (!dropResult) return;
    },
  });

  // Handle dropping an event on the calendar
  const handleEventDrop = useCallback(
    async ({ event, start, end }: { event: any; start: Date; end: Date }) => {
      setIsLoading(true);
      setError(null);
      
      try {
        await onRescheduleItem(event.id, start);
        toast({
          title: "Item rescheduled",
          description: "The campaign item has been rescheduled successfully",
          variant: "default",
        });
      } catch (err) {
        console.error('Error rescheduling item:', err);
        setError('Failed to reschedule item. Please try again.');
        toast({
          title: "Error",
          description: "Failed to reschedule the item",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [onRescheduleItem, toast]
  );

  // Handle clicking on an event
  const handleSelectEvent = useCallback(
    (event: any) => {
      const item = event.resource;
      if (item) {
        setSelectedItem(item);
        setIsModalOpen(true);
        setError(null);
      }
    },
    []
  );

  // Handle selecting a slot (clicking on an empty time slot)
  const handleSelectSlot = useCallback(
    ({ start }: { start: Date }) => {
      setSelectedSlot(start);
      setSelectedItem(null);
      setIsModalOpen(true);
      setError(null);
    },
    []
  );

  // Define custom components for the calendar
  const components = {
    event: (props: any) => <ItemComponent {...props} onReschedule={onRescheduleItem} />,
  };

  // Handle modal submit for creating or updating an item
  const handleModalSubmit = async (values: Partial<CampaignItem>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (selectedItem) {
        // Updating an existing item
        await onRescheduleItem(selectedItem.id, values.scheduledAt as Date);
        if (values.status !== selectedItem.status) {
          await onUpdateItemStatus(selectedItem.id, values.status as ItemStatus);
        }
        
        toast({
          title: "Item updated",
          description: "The campaign item has been updated successfully",
          variant: "default",
        });
        
        // If there's a custom edit handler, call it too
        if (onEditItem) {
          onEditItem({
            ...selectedItem,
            ...values,
          } as CampaignItem);
        }
      } else if (selectedSlot) {
        // Creating a new item with the selected slot time
        await createItem(campaign.id, {
          ...values,
          scheduledAt: selectedSlot,
          campaignId: campaign.id
        });
        
        toast({
          title: "Item created",
          description: "A new campaign item has been created",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error handling item submit:', error);
      setError('Failed to save the campaign item. Please try again.');
      toast({
        title: "Error",
        description: "Failed to save the campaign item",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateItem = () => {
    setSelectedItem(null);
    setSelectedSlot(new Date());
    setIsModalOpen(true);
    setError(null);
  };

  if (isDataLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Loading calendar data...</p>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="h-full flex flex-col"
        ref={drop}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="text-lg font-semibold flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2 text-blue-500" />
            {campaign.name}
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex bg-gray-100 rounded-md">
              <button
                onClick={() => setView(Views.DAY)}
                className={`px-3 py-1.5 text-sm ${view === Views.DAY ? 'bg-white shadow-sm rounded-md' : 'text-gray-600'}`}
                aria-label="Day view"
                aria-pressed={view === Views.DAY}
              >
                Day
              </button>
              <button
                onClick={() => setView(Views.WEEK)}
                className={`px-3 py-1.5 text-sm ${view === Views.WEEK ? 'bg-white shadow-sm rounded-md' : 'text-gray-600'}`}
                aria-label="Week view"
                aria-pressed={view === Views.WEEK}
              >
                Week
              </button>
              <button
                onClick={() => setView(Views.MONTH)}
                className={`px-3 py-1.5 text-sm ${view === Views.MONTH ? 'bg-white shadow-sm rounded-md' : 'text-gray-600'}`}
                aria-label="Month view"
                aria-pressed={view === Views.MONTH}
              >
                Month
              </button>
              <button
                onClick={() => setView(Views.AGENDA)}
                className={`px-3 py-1.5 text-sm ${view === Views.AGENDA ? 'bg-white shadow-sm rounded-md' : 'text-gray-600'}`}
                aria-label="Agenda view"
                aria-pressed={view === Views.AGENDA}
              >
                Agenda
              </button>
            </div>
            
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newDate = new Date(date);
                  if (view === Views.DAY) {
                    newDate.setDate(newDate.getDate() - 1);
                  } else if (view === Views.WEEK) {
                    newDate.setDate(newDate.getDate() - 7);
                  } else if (view === Views.MONTH) {
                    newDate.setMonth(newDate.getMonth() - 1);
                  }
                  setDate(newDate);
                }}
                aria-label="Previous period"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button
                onClick={() => setDate(new Date())}
                className="text-sm"
                variant="outline"
                size="sm"
              >
                Today
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newDate = new Date(date);
                  if (view === Views.DAY) {
                    newDate.setDate(newDate.getDate() + 1);
                  } else if (view === Views.WEEK) {
                    newDate.setDate(newDate.getDate() + 7);
                  } else if (view === Views.MONTH) {
                    newDate.setMonth(newDate.getMonth() + 1);
                  }
                  setDate(newDate);
                }}
                aria-label="Next period"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button 
              onClick={handleCreateItem}
              className="ml-2"
              size="sm"
              disabled={isLoading}
            >
              <PlusCircle className="mr-1 h-4 w-4" />
              Add Item
            </Button>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm flex items-start"
            role="alert"
          >
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 text-red-500" />
            <span>{error}</span>
          </motion.div>
        )}
      
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-4 right-4 bg-white shadow-md rounded-md p-2 z-50 flex items-center"
          >
            <Loader2 className="animate-spin h-4 w-4 mr-2 text-blue-500" />
            <span className="text-sm">Processing...</span>
          </motion.div>
        )}
        
        <div className="flex-grow bg-white rounded-md border shadow-sm overflow-hidden">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            view={view as any}
            onView={(newView) => setView(newView)}
            date={date}
            onNavigate={(newDate) => setDate(newDate)}
            selectable
            resizable
            onEventDrop={handleEventDrop}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            components={components}
            draggableAccessor={() => true}
            className="h-full rounded-md"
            style={{ minHeight: '70vh' }}
            dayPropGetter={(date) => {
              const today = new Date();
              return {
                className: 
                  date.getDate() === today.getDate() && 
                  date.getMonth() === today.getMonth() && 
                  date.getFullYear() === today.getFullYear() 
                    ? 'rbc-today bg-blue-50' 
                    : ''
              };
            }}
          />
        </div>

        <AnimatePresence>
          {isModalOpen && (
            <CampaignItemModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onSubmit={handleModalSubmit}
              initialData={selectedItem || (selectedSlot ? { scheduledAt: selectedSlot } : undefined)}
              campaignId={campaign.id}
              isEdit={!!selectedItem}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </DndProvider>
  );
}

export default CampaignCalendar; 