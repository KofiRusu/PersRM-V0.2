import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CampaignItem, CampaignItemType } from '@prisma/client';
import { motion } from 'framer-motion';
import { CalendarIcon, Clock, Tag, Edit2 } from 'lucide-react';
import { format } from 'date-fns';

interface SortableItemProps {
  id: string;
  item: CampaignItem;
  onEdit?: (id: string) => void;
}

export default function SortableItem({ id, item, onEdit }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const getTypeColor = (type: CampaignItemType) => {
    switch (type) {
      case CampaignItemType.POST:
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case CampaignItemType.EMAIL:
        return 'bg-green-100 border-green-300 text-green-800';
      case CampaignItemType.DM:
        return 'bg-purple-100 border-purple-300 text-purple-800';
      case CampaignItemType.EXPERIMENT:
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case CampaignItemType.TASK:
        return 'bg-gray-100 border-gray-300 text-gray-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
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

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return '';
      case 'ACTIVE':
        return 'border-l-4 border-l-amber-500';
      case 'COMPLETED':
        return 'opacity-80';
      case 'FAILED':
        return 'opacity-75 border-l-4 border-l-red-500';
      default:
        return '';
    }
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-md shadow-sm border p-2 cursor-grab active:cursor-grabbing ${getStatusStyles(item.status)} hover:shadow-md transition-all duration-150`}
      {...attributes}
      {...listeners}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      aria-roledescription="draggable item"
      aria-label={`${item.title}, type: ${item.type}, status: ${item.status}`}
      data-testid={`sortable-item-${id}`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">{item.title}</div>
          
          <div className="mt-1 flex flex-col gap-1">
            {item.scheduledAt && (
              <div className="text-xs text-gray-500 flex items-center">
                <CalendarIcon className="h-3 w-3 mr-1 inline-flex" />
                <span>{format(new Date(item.scheduledAt), 'MMM d, yyyy')}</span>
              </div>
            )}
            
            {item.description && (
              <div className="text-xs text-gray-500 truncate">
                {item.description.substring(0, 60)}
                {item.description.length > 60 && '...'}
              </div>
            )}
            
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {item.tags.slice(0, 2).map((tag, index) => (
                  <span key={index} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    {tag}
                  </span>
                ))}
                {item.tags.length > 2 && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                    +{item.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeColor(item.type)}`}>
            <span className="mr-1">{getTypeIcon(item.type)}</span>
            {item.type}
          </span>
          
          {onEdit && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onEdit(id);
              }}
              className="mt-2 text-gray-400 hover:text-blue-500 p-1 rounded-md hover:bg-gray-50 transition-colors"
              aria-label={`Edit ${item.title}`}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
} 