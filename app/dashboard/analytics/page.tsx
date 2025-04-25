'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';

// Types for our analytics data
interface Event {
  id: string;
  eventType: string;
  timestamp: string;
  sessionId: string;
  metadata: {
    action?: string;
    source?: string;
    triggerMethod?: string;
    duration?: number;
  } | null;
}

interface EventData {
  count: number;
  events: Event[];
}

interface EventStats {
  totalEvents: number;
  assistantOpens: number;
  assistantCloses: number;
  averageDuration: number;
  sourceCounts: Record<string, number>;
  dailyEvents: {
    date: string;
    opens: number;
    closes: number;
  }[];
}

const AnalyticsDashboard = () => {
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  // Fetch event data
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/logging/events?limit=1000`);
        if (!res.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        const data: EventData = await res.json();
        setEventData(data);
        processEventData(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Process event data to generate statistics
  const processEventData = (data: EventData) => {
    if (!data.events?.length) {
      setStats({
        totalEvents: 0,
        assistantOpens: 0,
        assistantCloses: 0,
        averageDuration: 0,
        sourceCounts: {},
        dailyEvents: []
      });
      return;
    }

    const assistantEvents = data.events.filter(e => e.eventType === 'assistant');
    
    // Count opens and closes
    const opens = assistantEvents.filter(e => e.metadata?.action === 'open');
    const closes = assistantEvents.filter(e => e.metadata?.action === 'close');
    
    // Calculate average session duration from close events with duration
    const durationsArray = closes
      .filter(e => e.metadata?.duration)
      .map(e => e.metadata?.duration || 0);
    const avgDuration = durationsArray.length 
      ? durationsArray.reduce((acc, val) => acc + val, 0) / durationsArray.length 
      : 0;
    
    // Count by source
    const sourceCounts: Record<string, number> = {};
    assistantEvents.forEach(e => {
      const source = e.metadata?.source || 'unknown';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    // Daily events for the chart
    const dailyMap: Record<string, { opens: number; closes: number }> = {};
    
    // Get date range based on timeRange
    let startDate = new Date();
    if (timeRange === '7d') {
      startDate = subDays(new Date(), 7);
    } else if (timeRange === '30d') {
      startDate = subDays(new Date(), 30);
    } else {
      // For 'all', we'll use the earliest event date
      const timestamps = assistantEvents.map(e => new Date(e.timestamp).getTime());
      if (timestamps.length) {
        startDate = new Date(Math.min(...timestamps));
      }
    }

    // Initialize daily map with all dates in range
    let currentDate = new Date(startDate);
    const today = new Date();
    while (currentDate <= today) {
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      dailyMap[dateKey] = { opens: 0, closes: 0 };
      currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
    }

    // Populate with actual data
    assistantEvents.forEach(e => {
      const date = format(new Date(e.timestamp), 'yyyy-MM-dd');
      if (!dailyMap[date]) {
        dailyMap[date] = { opens: 0, closes: 0 };
      }
      
      if (e.metadata?.action === 'open') {
        dailyMap[date].opens += 1;
      } else if (e.metadata?.action === 'close') {
        dailyMap[date].closes += 1;
      }
    });

    // Convert to array for charts
    const dailyEvents = Object.entries(dailyMap).map(([date, counts]) => ({
      date,
      opens: counts.opens,
      closes: counts.closes
    })).sort((a, b) => a.date.localeCompare(b.date));

    setStats({
      totalEvents: data.count,
      assistantOpens: opens.length,
      assistantCloses: closes.length,
      averageDuration: Math.round(avgDuration / 1000), // Convert to seconds
      sourceCounts,
      dailyEvents
    });
  };

  // Format a number as mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // For source usage pie chart
  const getSourceData = () => {
    if (!stats) return [];
    return Object.entries(stats.sourceCounts).map(([source, count]) => ({
      name: source,
      value: count
    }));
  };

  // Handle time range change
  const handleTimeRangeChange = (range: '7d' | '30d' | 'all') => {
    setTimeRange(range);
    if (eventData) {
      processEventData(eventData);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Reasoning Assistant Analytics</h1>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="bg-destructive/20 text-destructive p-4 rounded-md">
          Error: {error}
        </div>
      ) : (
        <>
          {/* Time Range Selector */}
          <div className="mb-6">
            <Tabs defaultValue="7d" className="w-full" onValueChange={(v) => handleTimeRangeChange(v as any)}>
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="7d">Last 7 Days</TabsTrigger>
                <TabsTrigger value="30d">Last 30 Days</TabsTrigger>
                <TabsTrigger value="all">All Time</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Stats Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalEvents || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Assistant Opens</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.assistantOpens || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Assistant Closes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.assistantCloses || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg. Session Duration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(stats?.averageDuration || 0)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Main Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Daily Usage Chart */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Daily Assistant Usage</CardTitle>
                <CardDescription>Opens and closes per day</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={stats?.dailyEvents || []}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="opens" stroke="#8884d8" activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="closes" stroke="#82ca9d" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Source Usage Pie Chart */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Interaction Sources</CardTitle>
                <CardDescription>How users are triggering the assistant</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getSourceData()}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard; 