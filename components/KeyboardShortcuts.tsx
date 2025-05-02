import React, { useState, useEffect } from 'react';
import { Command, KeyboardIcon, InfoIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';

interface ShortcutProps {
  keys: string[];
  description: string;
}

function Shortcut({ keys, description }: ShortcutProps): React.ReactElement {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-sm">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <React.Fragment key={key}>
            <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border">
              {key}
            </kbd>
            {index < keys.length - 1 && (
              <span className="text-xs text-muted-foreground">+</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutProps[];
}

interface KeyboardShortcutsProps {
  shortcutCategories: ShortcutCategory[];
}

export function KeyboardShortcuts({ shortcutCategories }: KeyboardShortcutsProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Handle keyboard shortcut to open the dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Open shortcuts dialog when '?' key is pressed
      if (e.key === '?' && !e.ctrlKey && !e.altKey) {
        setIsOpen(true);
      }
      
      // Close dialog when Escape is pressed
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-8"
          aria-label="Keyboard shortcuts"
        >
          <KeyboardIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Shortcuts</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-4 w-4" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use keyboard shortcuts to quickly navigate and perform actions.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 space-y-6">
          {shortcutCategories.map((category) => (
            <div key={category.title} className="space-y-2">
              <h3 className="font-medium text-sm">{category.title}</h3>
              <div className="bg-muted/50 rounded-md p-3 space-y-1">
                {category.shortcuts.map((shortcut, index) => (
                  <Shortcut
                    key={`${shortcut.description}-${index}`}
                    keys={shortcut.keys}
                    description={shortcut.description}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 flex items-center text-xs text-muted-foreground">
          <InfoIcon className="h-3 w-3 mr-1" />
          Press <kbd className="mx-1 px-1.5 py-0.5 text-xs bg-muted rounded border">?</kbd> to open this dialog at any time.
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Default keyboard shortcuts for campaign planner
export const defaultCampaignShortcuts: ShortcutCategory[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Tab'], description: 'Navigate between items' },
      { keys: ['Shift', 'Tab'], description: 'Navigate backward' },
      { keys: ['←', '→', '↑', '↓'], description: 'Navigate in calendar' },
    ],
  },
  {
    title: 'Calendar View',
    shortcuts: [
      { keys: ['D'], description: 'Switch to day view' },
      { keys: ['W'], description: 'Switch to week view' },
      { keys: ['M'], description: 'Switch to month view' },
      { keys: ['Today'], description: 'Jump to today' },
    ],
  },
  {
    title: 'Campaign Items',
    shortcuts: [
      { keys: ['N'], description: 'New campaign item' },
      { keys: ['E'], description: 'Edit selected item' },
      { keys: ['Enter'], description: 'Open selected item' },
      { keys: ['Delete'], description: 'Delete selected item' },
      { keys: ['Space'], description: 'Toggle item selection' },
      { keys: ['Shift', 'Click'], description: 'Select multiple items' },
    ],
  },
  {
    title: 'Campaign Management',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: 'Undo last action' },
      { keys: ['Ctrl', 'S'], description: 'Save changes' },
      { keys: ['Ctrl', 'F'], description: 'Search for items' },
      { keys: ['Esc'], description: 'Close dialogs/panels' },
    ],
  },
]; 