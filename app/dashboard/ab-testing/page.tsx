'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell
} from 'recharts';

// Types for our analytics data
interface Event {
  id: string;
  eventType: string;
  timestamp: string;
  sessionId: string;
  metadata: {
    testName?: string;
    variant?: string;
    testId?: string;
    animationVariant?: string;
  } | null;
}

interface EventData {
  count: number;
  events: Event[];
}

interface ABTestStats {
  totalAssignments: number;
  variantDistribution: {
    name: string;
    count: number;
  }[];
  interactionRates: {
    variant: string;
    views: number;
    interactions: number;
    interactionRate: number;
  }[];
  averageDwellTimes: {
    variant: string;
    averageDwellTime: number; // in seconds
  }[];
}

const ABTestingDashboard = () => {
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ABTestStats | null>(null);
  const [selectedTest, setSelectedTest] = useState<string>('reasoning-assistant-animation');

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD'];

  // Fetch event data
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/logging/events?limit=1000&eventType=ab-test`);
        if (!res.ok) {
          throw new Error('Failed to fetch A/B testing data');
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

  // Process event data to generate A/B test statistics
  const processEventData = (data: EventData) => {
    if (!data.events?.length) {
      setStats({
        totalAssignments: 0,
        variantDistribution: [],
        interactionRates: [],
        averageDwellTimes: [],
      });
      return;
    }

    // Filter for events related to the selected test
    const testEvents = data.events.filter(
      e => e.metadata?.testName === selectedTest || 
           (e.eventType.startsWith('ab-test') && !e.metadata?.testName)
    );
    
    // Count new variant assignments
    const assignmentEvents = testEvents.filter(
      e => e.eventType === 'ab-test-new-assignment' || e.eventType === 'ab-test-existing-assignment'
    );
    
    // Count by variant
    const variantCounts: Record<string, number> = {};
    assignmentEvents.forEach(e => {
      const variant = e.metadata?.variant || 'unknown';
      variantCounts[variant] = (variantCounts[variant] || 0) + 1;
    });
    
    // Panel open events by variant
    const openEvents: Record<string, number> = {};
    testEvents.filter(e => e.eventType === 'ab-test-panel-opened').forEach(e => {
      const variant = e.metadata?.animationVariant || e.metadata?.variant || 'unknown';
      openEvents[variant] = (openEvents[variant] || 0) + 1;
    });
    
    // Interaction events by variant
    const interactionEvents: Record<string, number> = {};
    testEvents.filter(e => e.eventType === 'ab-test-panel-interaction').forEach(e => {
      const variant = e.metadata?.animationVariant || e.metadata?.variant || 'unknown';
      interactionEvents[variant] = (interactionEvents[variant] || 0) + 1;
    });
    
    // Calculate interaction rates
    const interactionRates = Object.keys(variantCounts).map(variant => {
      const views = openEvents[variant] || 0;
      const interactions = interactionEvents[variant] || 0;
      const interactionRate = views > 0 ? (interactions / views) * 100 : 0;
      
      return {
        variant,
        views,
        interactions,
        interactionRate: parseFloat(interactionRate.toFixed(2)),
      };
    });
    
    // Prepare distribution data for charts
    const variantDistribution = Object.entries(variantCounts).map(([name, count]) => ({
      name,
      count,
    }));

    // Calculate average dwell times (placeholder - would need more data)
    const averageDwellTimes = Object.keys(variantCounts).map(variant => ({
      variant,
      averageDwellTime: Math.random() * 120, // Placeholder for demo
    }));

    setStats({
      totalAssignments: assignmentEvents.length,
      variantDistribution,
      interactionRates,
      averageDwellTimes,
    });
  };

  // Handle test selection change
  const handleTestChange = (testName: string) => {
    setSelectedTest(testName);
    if (eventData) {
      processEventData(eventData);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">A/B Testing Dashboard</h1>
      
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
          {/* Test Selector */}
          <div className="mb-6">
            <Tabs 
              defaultValue={selectedTest} 
              className="w-full" 
              onValueChange={handleTestChange}
            >
              <TabsList className="grid w-full max-w-md grid-cols-1">
                <TabsTrigger value="reasoning-assistant-animation">
                  Animation Variants Test
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Stats Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Test Participants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalAssignments || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Variants Tested</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.variantDistribution.length || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Best Performing Variant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.interactionRates.sort((a, b) => b.interactionRate - a.interactionRate)[0]?.variant || 'N/A'}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Highest Interaction Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.interactionRates.sort((a, b) => b.interactionRate - a.interactionRate)[0]?.interactionRate.toFixed(1) || 0}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Variant Distribution Chart */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Variant Distribution</CardTitle>
                <CardDescription>Number of users assigned to each variant</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.variantDistribution || []}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      dataKey="count"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats?.variantDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Interaction Rates Chart */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Interaction Rates by Variant</CardTitle>
                <CardDescription>Percentage of views that result in interaction</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats?.interactionRates || []}
                    margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="variant" />
                    <YAxis label={{ value: 'Interaction Rate (%)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Interaction Rate']} />
                    <Bar dataKey="interactionRate" fill="#8884d8">
                      {stats?.interactionRates.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default ABTestingDashboard; 