import { useState, useEffect, useCallback } from 'react';
import { CampaignStatus, ItemStatus, CampaignItemType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export interface CampaignItem {
  id: string;
  title: string;
  description?: string;
  type: CampaignItemType;
  status: ItemStatus;
  scheduledAt?: Date;
  completedAt?: Date;
  campaignId: string;
  createdAt: Date;
  updatedAt: Date;
  contentData?: string;
  start?: Date | string;
  end?: Date | string;
  tags?: string[];
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  items: CampaignItem[];
}

interface CampaignHistory {
  timestamp: Date;
  action: string;
  data: any;
}

interface CampaignPlannerState {
  campaigns: Campaign[];
  selectedCampaign: Campaign | null;
  isLoading: boolean;
  error: string | null;
  historyStack: CampaignHistory[];
  view: 'calendar' | 'board';
  items: CampaignItem[];
  history: CampaignItem[][];
  historyIndex: number;
}

interface CampaignPlannerHook extends CampaignPlannerState {
  // Fetch functions
  fetchCampaigns: (userId?: string) => Promise<void>;
  fetchCampaign: (campaignId: string) => Promise<void>;
  setSelectedCampaign: (campaign: Campaign | null) => void;
  setView: (view: 'calendar' | 'board') => void;
  
  // Actions
  updateItemSchedule: (itemId: string, scheduledAt: Date) => Promise<void>;
  updateItemStatus: (itemId: string, status: ItemStatus) => Promise<void>;
  updateCampaign: (campaignId: string, data: Partial<Campaign>) => Promise<void>;
  createItem: (campaignId: string, itemData: Partial<CampaignItem>) => Promise<void>;
  
  // Undo functionality
  canUndo: boolean;
  undo: () => Promise<void>;
  canRedo: boolean;
  redo: () => Promise<void>;
  
  // Campaign management
  addItem: (item: Omit<CampaignItem, 'id'>) => CampaignItem;
  updateItem: (id: string, updates: Partial<CampaignItem>) => void;
  deleteItem: (id: string) => void;
  getItemsByStatus: (status: ItemStatus) => CampaignItem[];
  saveCampaigns: () => Promise<void>;
}

export function useCampaignPlanner(): CampaignPlannerHook {
  const [state, setState] = useState<CampaignPlannerState>({
    campaigns: [],
    selectedCampaign: null,
    isLoading: false,
    error: null,
    historyStack: [],
    view: 'calendar',
    items: [],
    history: [[]],
    historyIndex: 0,
  });

  const { campaigns, selectedCampaign, isLoading, error, historyStack, view, items, history, historyIndex } = state;

  // Fetch all campaigns for a user
  const fetchCampaigns = useCallback(async (userId?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const query = userId ? `?userId=${userId}` : '';
      const response = await fetch(`/api/campaign${query}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      
      const data = await response.json();
      setState(prev => ({ 
        ...prev, 
        campaigns: data,
        isLoading: false 
      }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        error: err.message || 'An error occurred while fetching campaigns',
        isLoading: false 
      }));
    }
  }, []);

  // Fetch a specific campaign
  const fetchCampaign = useCallback(async (campaignId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch(`/api/campaign?campaignId=${campaignId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaign');
      }
      
      const data = await response.json();
      setState(prev => ({ 
        ...prev, 
        selectedCampaign: data,
        isLoading: false 
      }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        error: err.message || 'An error occurred while fetching the campaign',
        isLoading: false 
      }));
    }
  }, []);

  // Add action to history stack
  const addToHistory = useCallback((action: string, data: any) => {
    setState(prev => ({
      ...prev,
      historyStack: [
        ...prev.historyStack,
        {
          timestamp: new Date(),
          action,
          data
        }
      ]
    }));
  }, []);

  // Update item schedule (used for drag-and-drop)
  const updateItemSchedule = useCallback(async (itemId: string, scheduledAt: Date) => {
    if (!selectedCampaign) return;
    
    // Find the item to be updated
    const item = selectedCampaign.items.find(i => i.id === itemId);
    if (!item) return;
    
    // Save the previous state for undo
    const previousState = { ...item };
    
    // Optimistically update UI
    setState(prev => {
      if (!prev.selectedCampaign) return prev;
      
      const updatedItems = prev.selectedCampaign.items.map(i => 
        i.id === itemId 
          ? { ...i, scheduledAt, updatedAt: new Date() } 
          : i
      );
      
      const updatedCampaign = {
        ...prev.selectedCampaign,
        items: updatedItems
      };
      
      return {
        ...prev,
        selectedCampaign: updatedCampaign
      };
    });
    
    try {
      // Send update to the server
      const response = await fetch('/api/campaign/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'UPDATE_SCHEDULE',
          data: {
            itemId,
            scheduledAt
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update item schedule');
      }
      
      // Add to history stack for undo
      addToHistory('UPDATE_SCHEDULE', { 
        itemId, 
        previousScheduledAt: previousState.scheduledAt 
      });
      
    } catch (err: any) {
      // Revert optimistic update on error
      setState(prev => {
        if (!prev.selectedCampaign) return prev;
        
        const revertedItems = prev.selectedCampaign.items.map(i => 
          i.id === itemId ? previousState : i
        );
        
        return {
          ...prev,
          selectedCampaign: {
            ...prev.selectedCampaign,
            items: revertedItems
          },
          error: err.message || 'Failed to update item schedule'
        };
      });
    }
  }, [selectedCampaign, addToHistory]);

  // Update item status
  const updateItemStatus = useCallback(async (itemId: string, status: ItemStatus) => {
    if (!selectedCampaign) return;
    
    // Find the item to be updated
    const item = selectedCampaign.items.find(i => i.id === itemId);
    if (!item) return;
    
    // Save previous state for undo
    const previousState = { ...item };
    
    // Optimistically update UI
    setState(prev => {
      if (!prev.selectedCampaign) return prev;
      
      const updatedItems = prev.selectedCampaign.items.map(i => 
        i.id === itemId 
          ? { 
              ...i, 
              status, 
              updatedAt: new Date(),
              // If completed, set completedAt
              ...(status === 'COMPLETED' ? { completedAt: new Date() } : {})
            } 
          : i
      );
      
      return {
        ...prev,
        selectedCampaign: {
          ...prev.selectedCampaign,
          items: updatedItems
        }
      };
    });
    
    try {
      // Send update to the server
      const response = await fetch('/api/campaign/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'UPDATE_STATUS',
          data: {
            itemId,
            status
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update item status');
      }
      
      // Add to history stack for undo
      addToHistory('UPDATE_STATUS', { 
        itemId, 
        previousStatus: previousState.status,
        previousCompletedAt: previousState.completedAt
      });
      
    } catch (err: any) {
      // Revert optimistic update on error
      setState(prev => {
        if (!prev.selectedCampaign) return prev;
        
        const revertedItems = prev.selectedCampaign.items.map(i => 
          i.id === itemId ? previousState : i
        );
        
        return {
          ...prev,
          selectedCampaign: {
            ...prev.selectedCampaign,
            items: revertedItems
          },
          error: err.message || 'Failed to update item status'
        };
      });
    }
  }, [selectedCampaign, addToHistory]);

  // Update campaign
  const updateCampaign = useCallback(async (campaignId: string, data: Partial<Campaign>) => {
    if (!selectedCampaign || selectedCampaign.id !== campaignId) return;
    
    // Save previous state for undo
    const previousState = { ...selectedCampaign };
    
    // Optimistically update UI
    setState(prev => {
      if (!prev.selectedCampaign || prev.selectedCampaign.id !== campaignId) return prev;
      
      const updatedCampaign = {
        ...prev.selectedCampaign,
        ...data,
        updatedAt: new Date()
      };
      
      return {
        ...prev,
        selectedCampaign: updatedCampaign
      };
    });
    
    try {
      // Send update to the server
      const response = await fetch('/api/campaign/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'UPDATE_CAMPAIGN',
          data: {
            campaignId,
            ...data
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update campaign');
      }
      
      // Add to history stack for undo
      addToHistory('UPDATE_CAMPAIGN', { 
        campaignId, 
        previousState
      });
      
    } catch (err: any) {
      // Revert optimistic update on error
      setState(prev => ({
        ...prev,
        selectedCampaign: previousState,
        error: err.message || 'Failed to update campaign'
      }));
    }
  }, [selectedCampaign, addToHistory]);

  // Create a new campaign item
  const createItem = useCallback(async (campaignId: string, itemData: Partial<CampaignItem>) => {
    if (!selectedCampaign || selectedCampaign.id !== campaignId) return;
    
    // Temporary ID for optimistic UI update
    const tempId = `temp-${Date.now()}`;
    
    // Optimistically add the item
    setState(prev => {
      if (!prev.selectedCampaign) return prev;
      
      const newItem = {
        id: tempId,
        title: itemData.title || 'New Item',
        type: itemData.type || 'TASK',
        status: 'SCHEDULED',
        scheduledAt: itemData.scheduledAt || new Date(),
        campaignId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...itemData
      };
      
      return {
        ...prev,
        selectedCampaign: {
          ...prev.selectedCampaign,
          items: [...prev.selectedCampaign.items, newItem as unknown as CampaignItem]
        }
      };
    });
    
    try {
      // Send the create request to the server
      const response = await fetch('/api/campaign/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'CREATE_ITEM',
          data: {
            campaignId,
            ...itemData
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create item');
      }
      
      // Get the newly created item with real ID
      const createdItem = await response.json();
      
      // Replace the temporary item with the real one
      setState(prev => {
        if (!prev.selectedCampaign) return prev;
        
        const updatedItems = prev.selectedCampaign.items
          .filter(item => item.id !== tempId)
          .concat(createdItem.data);
        
        return {
          ...prev,
          selectedCampaign: {
            ...prev.selectedCampaign,
            items: updatedItems
          }
        };
      });
      
      // Add to history stack for undo
      addToHistory('CREATE_ITEM', { 
        campaignId, 
        itemId: createdItem.data.id
      });
      
    } catch (err: any) {
      // Remove the optimistically added item on error
      setState(prev => {
        if (!prev.selectedCampaign) return prev;
        
        return {
          ...prev,
          selectedCampaign: {
            ...prev.selectedCampaign,
            items: prev.selectedCampaign.items.filter(item => item.id !== tempId)
          },
          error: err.message || 'Failed to create item'
        };
      });
    }
  }, [selectedCampaign, addToHistory]);

  // Implement undo functionality
  const undo = useCallback(async () => {
    if (historyStack.length === 0) return;
    
    // Get the last action from the stack
    const lastAction = historyStack[historyStack.length - 1];
    
    try {
      switch (lastAction.action) {
        case 'UPDATE_SCHEDULE': {
          const { itemId, previousScheduledAt } = lastAction.data;
          await updateItemSchedule(itemId, previousScheduledAt);
          break;
        }
        
        case 'UPDATE_STATUS': {
          const { itemId, previousStatus } = lastAction.data;
          await updateItemStatus(itemId, previousStatus);
          break;
        }
        
        case 'UPDATE_CAMPAIGN': {
          const { campaignId, previousState } = lastAction.data;
          await updateCampaign(campaignId, previousState);
          break;
        }
        
        case 'CREATE_ITEM': {
          // For created items, we would need a delete API endpoint
          // This is not implemented yet, but would be needed for a complete undo feature
          console.warn('Undo for item creation not implemented yet');
          break;
        }
        
        default:
          console.warn(`Undo not implemented for action type: ${lastAction.action}`);
      }
      
      // Remove the undone action from history
      setState(prev => ({
        ...prev,
        historyStack: prev.historyStack.slice(0, -1)
      }));
      
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        error: err.message || 'Failed to undo last action'
      }));
    }
  }, [historyStack, updateItemSchedule, updateItemStatus, updateCampaign]);

  // Helper functions
  const setSelectedCampaign = useCallback((campaign: Campaign | null) => {
    setState(prev => ({ ...prev, selectedCampaign: campaign }));
  }, []);

  const setView = useCallback((newView: 'calendar' | 'board') => {
    setState(prev => ({ ...prev, view: newView }));
  }, []);

  const saveToHistory = useCallback((newItems: CampaignItem[]) => {
    setState(prev => {
      // Remove any "future" history if we've gone back in time and are now creating a new timeline
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      return {
        items: newItems,
        history: [...newHistory, newItems],
        historyIndex: newHistory.length,
      };
    });
  }, []);

  const addItem = useCallback((item: Omit<CampaignItem, 'id'>) => {
    const newItem = { ...item, id: uuidv4() } as CampaignItem;
    setState(prev => {
      const newItems = [...prev.items, newItem];
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      return {
        items: newItems,
        history: [...newHistory, newItems],
        historyIndex: newHistory.length,
      };
    });
    return newItem;
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<CampaignItem>) => {
    setState(prev => {
      const newItems = prev.items.map(item => 
        item.id === id ? { ...item, ...updates } : item
      );
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      return {
        items: newItems,
        history: [...newHistory, newItems],
        historyIndex: newHistory.length,
      };
    });
  }, []);

  const deleteItem = useCallback((id: string) => {
    setState(prev => {
      const newItems = prev.items.filter(item => item.id !== id);
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      return {
        items: newItems,
        history: [...newHistory, newItems],
        historyIndex: newHistory.length,
      };
    });
  }, []);

  const getItemsByStatus = useCallback((status: ItemStatus) => {
    return state.items.filter(item => item.status === status);
  }, [state.items]);
  
  const saveCampaigns = useCallback(async () => {
    try {
      const response = await fetch('/api/campaign/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: state.items }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save campaigns');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error saving campaigns:', error);
      throw error;
    }
  }, [state.items]);

  return {
    // State
    campaigns,
    selectedCampaign,
    isLoading,
    error,
    historyStack,
    view,
    items,
    history,
    historyIndex,
    
    // Fetch functions
    fetchCampaigns,
    fetchCampaign,
    setSelectedCampaign,
    setView,
    
    // Actions
    updateItemSchedule,
    updateItemStatus,
    updateCampaign,
    createItem,
    
    // Undo
    canUndo: historyStack.length > 0,
    undo,
    
    // Redo
    canRedo: historyIndex < history.length - 1,
    redo,
    
    // Campaign management
    addItem,
    updateItem,
    deleteItem,
    getItemsByStatus,
    saveCampaigns,
  };
} 