import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CampaignStatus, ItemStatus, CampaignItemType } from '@prisma/client'

/**
 * Combines multiple class values using clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

type StatusColorReturn = string;

/**
 * Get color for campaign status
 */
export function getCampaignStatusColor(status: CampaignStatus): StatusColorReturn {
  switch (status) {
    case CampaignStatus.ACTIVE:
      return 'bg-green-100 text-green-800 border-green-300'
    case CampaignStatus.COMPLETED:
      return 'bg-blue-100 text-blue-800 border-blue-300'
    case CampaignStatus.DRAFT:
      return 'bg-orange-100 text-orange-800 border-orange-300'
    case CampaignStatus.ARCHIVED:
      return 'bg-gray-100 text-gray-800 border-gray-300'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}

/**
 * Get color for item status
 */
export function getItemStatusColor(status: ItemStatus): StatusColorReturn {
  switch (status) {
    case ItemStatus.ACTIVE:
      return 'bg-green-100 text-green-800 border-green-300'
    case ItemStatus.COMPLETED:
      return 'bg-blue-100 text-blue-800 border-blue-300'
    case ItemStatus.SCHEDULED:
      return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    case ItemStatus.FAILED:
      return 'bg-red-100 text-red-800 border-red-300'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}

/**
 * Get icon for campaign item type
 */
export function getItemTypeIcon(type: CampaignItemType): string {
  switch (type) {
    case CampaignItemType.POST:
      return '📱'
    case CampaignItemType.EMAIL:
      return '📧'
    case CampaignItemType.DM:
      return '💬'
    case CampaignItemType.EXPERIMENT:
      return '🧪'
    case CampaignItemType.TASK:
      return '✅'
    default:
      return '📋'
  }
}

type DateFormatType = 'short' | 'medium' | 'long' | 'time';

/**
 * Format date with options for different formats
 */
export function formatDate(
  date: Date | string | undefined, 
  format: DateFormatType = 'medium'
): string {
  if (!date) return 'N/A'
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  const options: Intl.DateTimeFormatOptions = {
    weekday: format === 'short' ? undefined : 'short',
    month: format === 'short' ? 'numeric' : 'short',
    day: 'numeric',
    year: format === 'long' ? 'numeric' : undefined,
    hour: format === 'time' || format === 'long' ? 'numeric' : undefined,
    minute: format === 'time' || format === 'long' ? 'numeric' : undefined,
  }
  
  return dateObj.toLocaleDateString('en-US', options)
}

/**
 * Check if a date is in the past
 */
export function isDatePast(date: Date | string | undefined): boolean {
  if (!date) return false
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj < new Date()
}

/**
 * Format tags array into displayable string
 */
export function formatTags(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) return ''
  return tags.join(', ')
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

/**
 * Calculate date difference in days
 */
export function getDateDiffInDays(startDate: Date | string, endDate: Date | string): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate
  
  const diffTime = Math.abs(end.getTime() - start.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
} 