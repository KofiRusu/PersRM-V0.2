import React, { useState, useRef, useEffect } from 'react';
import { XIcon, PlusIcon, TagIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags?: string[];
  disabled?: boolean;
  maxTags?: number;
  placeholder?: string;
  className?: string;
}

export function TagInput({
  tags,
  onTagsChange,
  availableTags = [],
  disabled = false,
  maxTags = 10,
  placeholder = 'Add a tag...',
  className,
}: TagInputProps): React.ReactElement {
  const [inputValue, setInputValue] = useState<string>('');
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input value
  useEffect(() => {
    if (inputValue.trim() === '') {
      setSuggestions([]);
      return;
    }

    const filtered = availableTags
      .filter(tag => 
        !tags.includes(tag) && 
        tag.toLowerCase().includes(inputValue.toLowerCase())
      )
      .slice(0, 5); // Limit to 5 suggestions
      
    setSuggestions(filtered);
    setSelectedSuggestionIndex(-1);
  }, [inputValue, availableTags, tags]);

  // Add a tag
  const addTag = (tag: string): void => {
    const trimmedTag = tag.trim();
    
    if (
      trimmedTag !== '' && 
      !tags.includes(trimmedTag) && 
      tags.length < maxTags
    ) {
      const newTags = [...tags, trimmedTag];
      onTagsChange(newTags);
    }
    
    setInputValue('');
    setSuggestions([]);
    
    // Focus the input after adding a tag
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 10);
  };

  // Remove a tag
  const removeTag = (tagToRemove: string): void => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    onTagsChange(newTags);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && inputValue) {
      e.preventDefault();
      
      if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
        // Add the selected suggestion
        addTag(suggestions[selectedSuggestionIndex]);
      } else {
        // Add the current input value
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      // Remove the last tag when backspace is pressed on empty input
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
      // Navigate down through suggestions
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      // Navigate up through suggestions
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : prev
      );
    } else if (e.key === 'Escape') {
      // Close suggestions
      setSuggestions([]);
      setSelectedSuggestionIndex(-1);
    } else if (e.key === 'Tab' && selectedSuggestionIndex >= 0 && suggestions.length > 0) {
      // Complete with selected suggestion on tab
      e.preventDefault();
      addTag(suggestions[selectedSuggestionIndex]);
    } else if (e.key === ',' || e.key === ' ') {
      // Add tag on comma or space
      if (inputValue) {
        e.preventDefault();
        addTag(inputValue.replace(',', ''));
      }
    }
  };

  // Handle outside click to close suggestions
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestions([]);
        setIsInputFocused(false);
      }
    };
    
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "border border-input p-1 rounded-md flex flex-wrap gap-1 focus-within:ring-1 focus-within:ring-ring relative",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="flex flex-wrap gap-1 items-center">
        {tags.map((tag) => (
          <motion.div
            key={tag}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <Badge
              variant="secondary"
              className="flex items-center gap-1 text-xs py-0 h-6"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                aria-label={`Remove tag ${tag}`}
                className="rounded-full hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring p-0.5"
              >
                <XIcon className="h-3 w-3" />
                <span className="sr-only">Remove tag {tag}</span>
              </button>
            </Badge>
          </motion.div>
        ))}
        
        <div className="flex-1 min-w-[120px]">
          <div className="flex items-center">
            {tags.length === 0 && !isInputFocused && (
              <TagIcon className="h-3 w-3 text-muted-foreground mr-1 ml-1" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onKeyDown={handleKeyDown}
              disabled={disabled || tags.length >= maxTags}
              placeholder={tags.length === 0 ? placeholder : ''}
              className="flex-1 outline-none bg-transparent p-1 text-sm"
              aria-label="Add tags"
              style={{
                width: inputValue ? `${Math.max(inputValue.length * 8, 60)}px` : '80px',
                minWidth: '80px',
              }}
            />
          </div>
        </div>
      </div>
      
      {tags.length >= maxTags && (
        <div className="absolute right-2 top-2 text-xs text-muted-foreground">
          Maximum {maxTags} tags
        </div>
      )}
      
      <AnimatePresence>
        {suggestions.length > 0 && isInputFocused && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1 z-50 bg-background border rounded-md shadow-md overflow-hidden"
          >
            <ul className="py-1">
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion}
                  className={cn(
                    "px-2 py-1 text-sm cursor-pointer flex items-center gap-1 hover:bg-muted",
                    selectedSuggestionIndex === index && "bg-muted"
                  )}
                  onClick={() => addTag(suggestion)}
                  onMouseEnter={() => setSelectedSuggestionIndex(index)}
                >
                  <PlusIcon className="h-3 w-3 text-muted-foreground" />
                  {suggestion}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 