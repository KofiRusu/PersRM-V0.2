import React, { useState } from 'react';
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CampaignStatus } from '@prisma/client';
import { motion, AnimatePresence } from 'framer-motion';
import SortableItem from './SortableItem';
import useCampaignPlanner, { CampaignItem } from '../hooks/useCampaignPlanner';
import { CampaignItemModal } from './CampaignItemModal';
import { Button } from './ui/button';
import { PlusCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { SkeletonCampaignBoard } from './SkeletonCampaignBoard';

// Column component to represent each status
const StatusColumn = ({ status, items, onEdit }: { status: CampaignStatus, items: CampaignItem[], onEdit?: (id: string) => void }) => {
  const statusLabels: Record<CampaignStatus, string> = {
    DRAFT: 'Draft',
    SCHEDULED: 'Scheduled',
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
  
  const statusColors: Record<CampaignStatus, string> = {
    DRAFT: 'bg-gray-100 border-gray-300',
    SCHEDULED: 'bg-blue-50 border-blue-200',
    ACTIVE: 'bg-amber-50 border-amber-200',
    COMPLETED: 'bg-green-50 border-green-200',
    CANCELLED: 'bg-red-50 border-red-200',
  };
  
  const statusHeaderColors: Record<CampaignStatus, string> = {
    DRAFT: 'bg-gray-200 text-gray-800',
    SCHEDULED: 'bg-blue-100 text-blue-800',
    ACTIVE: 'bg-amber-100 text-amber-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col min-w-[250px] h-full rounded-md p-0 shadow-sm border ${statusColors[status]}`}
    >
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-md ${statusHeaderColors[status]}`}>
        <h3 className="text-sm font-medium">
          {statusLabels[status]} 
          <span className="ml-1 inline-flex items-center justify-center w-5 h-5 bg-white bg-opacity-70 rounded-full text-xs">
            {items.length}
          </span>
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence>
            {items.length > 0 ? (
              <div className="space-y-2">
                {items.map(item => (
                  <SortableItem 
                    key={item.id} 
                    id={item.id} 
                    item={item} 
                    onEdit={onEdit} 
                  />
                ))}
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 0.7 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-24 text-center text-gray-400 text-sm"
              >
                <p>No items</p>
                <p className="text-xs">Drag items here or add new ones</p>
              </motion.div>
            )}
          </AnimatePresence>
        </SortableContext>
      </div>
    </motion.div>
  );
};

interface CampaignBoardProps {
  initialItems?: CampaignItem[];
  onEdit?: (id: string) => void;
  campaignId: string;
}

export default function CampaignBoard({ initialItems = [], onEdit, campaignId }: CampaignBoardProps) {
  const { 
    items, 
    updateItem, 
    getItemsByStatus, 
    undo, 
    canUndo, 
    saveCampaigns,
    createItem,
    isLoading
  } = useCampaignPlanner(initialItems);
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CampaignItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const statuses = [
    CampaignStatus.DRAFT,
    CampaignStatus.SCHEDULED,
    CampaignStatus.ACTIVE,
    CampaignStatus.COMPLETED,
    CampaignStatus.CANCELLED
  ];

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    // Clear any existing error message when starting a drag
    setError(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    // If no destination or same position, do nothing
    if (!over || active.id === over.id) return;

    // If moving within the same column, reorder items
    const activeItem = items.find(item => item.id === active.id);
    const overItem = items.find(item => item.id === over.id);
    
    if (activeItem && overItem && activeItem.status === overItem.status) {
      // This is where you would implement reordering logic if needed
    }

    setIsSaving(true);
    try {
      await saveCampaigns();
    } catch (error) {
      console.error('Failed to save campaign changes:', error);
      setError('Failed to save changes. Please try again.');
      toast({
        title: "Save Error",
        description: "Failed to save your changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    // Exit if no destination
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Find the items
    const activeItem = items.find(item => item.id === activeId);
    const overItem = items.find(item => item.id === overId);
    
    // If dropping onto another item, possibly changing status
    if (activeItem && overItem && activeItem.status !== overItem.status) {
      updateItem(activeId, { status: overItem.status });
    }
  };

  const handleEditItem = (itemId: string) => {
    const item = items.find(item => item.id === itemId);
    if (item) {
      setSelectedItem(item);
      setIsModalOpen(true);
    }
  };

  const handleCreateItem = () => {
    setSelectedItem(null);
    setIsModalOpen(true);
    setError(null);
  };

  const handleModalSubmit = async (values: Partial<CampaignItem>) => {
    setIsSaving(true);
    setError(null);
    
    try {
      if (selectedItem) {
        // Update existing item
        await updateItem(selectedItem.id, values);
        toast({
          title: "Item updated",
          description: "The campaign item has been updated successfully",
          variant: "default",
        });
      } else {
        // Create new item
        if (campaignId) {
          await createItem(campaignId, {
            ...values,
            campaignId
          } as Partial<CampaignItem>);
          toast({
            title: "Item created",
            description: "A new campaign item has been created",
            variant: "default",
          });
        }
      }
      return saveCampaigns();
    } catch (error) {
      console.error('Error handling item submit:', error);
      setError('Failed to save the campaign item. Please try again.');
      toast({
        title: "Error",
        description: "Failed to save the campaign item",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndo = async () => {
    setIsSaving(true);
    try {
      await undo();
      toast({
        title: "Change undone",
        description: "Your last change has been undone",
        variant: "default",
      });
    } catch (error) {
      console.error('Failed to undo:', error);
      setError('Failed to undo. Please try again.');
      toast({
        title: "Error",
        description: "Failed to undo your last change",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Campaign Board</h2>
        </div>
        <SkeletonCampaignBoard />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Campaign Board</h2>
        <div className="flex space-x-2">
          <Button 
            onClick={handleUndo}
            disabled={!canUndo || isSaving}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md disabled:opacity-50 transition-opacity"
            variant="outline"
            aria-label="Undo last action"
          >
            Undo
          </Button>
          <Button 
            onClick={handleCreateItem}
            disabled={isSaving}
            className="px-3 py-1 text-sm transition-all"
            variant="default"
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
      
      {isSaving && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed top-4 right-4 bg-white shadow-md rounded-md p-2 z-50 flex items-center"
        >
          <RefreshCw className="animate-spin h-4 w-4 mr-2 text-blue-500" />
          <span className="text-sm">Saving changes...</span>
        </motion.div>
      )}
      
      <div className="flex-1 overflow-hidden">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
        >
          <div className="flex gap-4 overflow-x-auto h-full pb-4">
            {statuses.map(status => (
              <StatusColumn 
                key={status} 
                status={status} 
                items={getItemsByStatus(status)}
                onEdit={handleEditItem}
              />
            ))}
          </div>
        </DndContext>
      </div>

      {isModalOpen && (
        <CampaignItemModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleModalSubmit}
          initialData={selectedItem || undefined}
          campaignId={campaignId}
          isEdit={!!selectedItem}
        />
      )}
    </div>
  );
} 