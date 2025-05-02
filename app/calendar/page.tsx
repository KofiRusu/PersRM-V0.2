'use client';

import { useState } from 'react';
import { CalendarView } from '@/components/calendar/CalendarView';
import { Button } from '@/components/ui/button';
import { CalendarIcon, PlusIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function CalendarPage() {
  const [view, setView] = useState<'month' | 'week'>('month');

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <CalendarIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Calendar</h1>
        </div>
        <div className="flex items-center space-x-2">
          <div className="hidden md:flex bg-muted rounded-lg p-1">
            <Button
              variant={view === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('month')}
              className="text-xs"
            >
              Month
            </Button>
            <Button
              variant={view === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('week')}
              className="text-xs"
              disabled={true} // Temporarily disabled until week view is implemented
            >
              Week
            </Button>
          </div>
          <Button asChild size="sm" className="gap-1">
            <Link href="/tasks/new">
              <PlusIcon className="h-4 w-4" />
              New Task
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 pb-0">
          <CardTitle className="text-lg">Tasks Calendar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <CalendarView view={view} />
        </CardContent>
      </Card>
    </div>
  );
} 