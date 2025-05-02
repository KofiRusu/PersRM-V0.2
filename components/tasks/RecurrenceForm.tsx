'use client';

import { useState, useEffect } from 'react';
import { RadioGroup } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { formatRecurrencePattern } from '@/lib/utils/recurrence';
import { cn } from '@/lib/utils';

type RecurrencePattern = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

interface RecurrenceFormProps {
  value?: {
    pattern: RecurrencePattern;
    interval: number;
    endsAt?: Date | null;
  };
  onChange: (data: {
    pattern: RecurrencePattern;
    interval: number;
    endsAt?: Date | null;
  }) => void;
  className?: string;
}

export function RecurrenceForm({ value, onChange, className }: RecurrenceFormProps) {
  const [pattern, setPattern] = useState<RecurrencePattern>(value?.pattern || 'DAILY');
  const [interval, setInterval] = useState<number>(value?.interval || 1);
  const [endsAt, setEndsAt] = useState<Date | null>(value?.endsAt || null);

  // Update form state when value prop changes
  useEffect(() => {
    if (value) {
      setPattern(value.pattern);
      setInterval(value.interval);
      setEndsAt(value.endsAt || null);
    }
  }, [value]);

  // Handle changes and notify parent
  const handleChange = () => {
    onChange({
      pattern,
      interval,
      endsAt,
    });
  };

  // Handle pattern change
  const handlePatternChange = (newPattern: RecurrencePattern) => {
    setPattern(newPattern);
    onChange({
      pattern: newPattern,
      interval,
      endsAt,
    });
  };

  // Handle interval change
  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newInterval = Math.max(1, parseInt(e.target.value, 10) || 1);
    setInterval(newInterval);
    onChange({
      pattern,
      interval: newInterval,
      endsAt,
    });
  };

  // Handle end date change
  const handleEndDateChange = (date: Date | null) => {
    setEndsAt(date);
    onChange({
      pattern,
      interval,
      endsAt: date,
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label>Repeat Pattern</Label>
        <RadioGroup 
          value={pattern} 
          onValueChange={(val) => handlePatternChange(val as RecurrencePattern)}
          className="flex flex-col space-y-1"
        >
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="daily"
              value="DAILY"
              checked={pattern === 'DAILY'}
              onChange={() => handlePatternChange('DAILY')}
              className="h-4 w-4"
            />
            <Label htmlFor="daily" className="font-normal cursor-pointer">Daily</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="weekly"
              value="WEEKLY"
              checked={pattern === 'WEEKLY'}
              onChange={() => handlePatternChange('WEEKLY')}
              className="h-4 w-4"
            />
            <Label htmlFor="weekly" className="font-normal cursor-pointer">Weekly</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="monthly"
              value="MONTHLY"
              checked={pattern === 'MONTHLY'}
              onChange={() => handlePatternChange('MONTHLY')}
              className="h-4 w-4"
            />
            <Label htmlFor="monthly" className="font-normal cursor-pointer">Monthly</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="custom"
              value="CUSTOM"
              checked={pattern === 'CUSTOM'}
              onChange={() => handlePatternChange('CUSTOM')}
              className="h-4 w-4"
            />
            <Label htmlFor="custom" className="font-normal cursor-pointer">Custom</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="interval">Interval</Label>
        <div className="flex items-center space-x-2">
          <span>Every</span>
          <Input
            id="interval"
            type="number"
            min={1}
            value={interval}
            onChange={handleIntervalChange}
            className="w-20"
          />
          <span>
            {pattern === 'DAILY' && (interval === 1 ? 'day' : 'days')}
            {pattern === 'WEEKLY' && (interval === 1 ? 'week' : 'weeks')}
            {pattern === 'MONTHLY' && (interval === 1 ? 'month' : 'months')}
            {pattern === 'CUSTOM' && 'days'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>End Date (Optional)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !endsAt && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endsAt ? format(endsAt, "PPP") : "No end date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={endsAt || undefined}
              onSelect={handleEndDateChange}
              initialFocus
            />
            <div className="p-3 border-t border-border">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => handleEndDateChange(null)}
              >
                Clear
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {value && (
        <div className="text-sm text-muted-foreground pt-2">
          <span>Summary: </span>
          <span className="font-medium text-foreground">
            {formatRecurrencePattern(pattern, interval)}
          </span>
          {endsAt && (
            <span> (ends on {format(endsAt, "MMM d, yyyy")})</span>
          )}
        </div>
      )}
    </div>
  );
} 