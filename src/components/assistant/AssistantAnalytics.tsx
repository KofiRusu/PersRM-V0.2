'use client';

import React, { useState } from 'react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement,
  Title, 
  Tooltip, 
  Legend, 
  ArcElement 
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { trpc } from '@/lib/trpc/trpcClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { addDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function AssistantAnalytics() {
  const [dateRange, setDateRange] = useState({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  
  // Get overall stats
  const { data: overallStats, isLoading: isOverallStatsLoading, refetch: refetchOverallStats } = 
    trpc.assistantLog.getOverallStats.useQuery();
  
  // Get daily stats
  const { data: dailyStats, isLoading: isDailyStatsLoading, refetch: refetchDailyStats } = 
    trpc.assistantLog.getDailyStats.useQuery({
      startDate: dateRange.from,
      endDate: dateRange.to,
    });
  
  // Get variant stats
  const { data: variantStats, isLoading: isVariantStatsLoading, refetch: refetchVariantStats } = 
    trpc.assistantLog.getVariantStats.useQuery();
  
  const refreshData = () => {
    refetchOverallStats();
    refetchDailyStats();
    refetchVariantStats();
  };
  
  // Prepare charts data
  const dailyUsageData = {
    labels: dailyStats?.dailyStats.map((stat: any) => new Date(stat.date).toLocaleDateString()) || [],
    datasets: [
      {
        label: 'Total Events',
        data: dailyStats?.dailyStats.map((stat: any) => stat.count) || [],
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      },
      {
        label: 'Open Events',
        data: dailyStats?.dailyStats.map((stat: any) => stat.openCount) || [],
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
      },
      {
        label: 'Close Events',
        data: dailyStats?.dailyStats.map((stat: any) => stat.closeCount) || [],
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
      },
    ],
  };
  
  const triggerSourceData = {
    labels: ['Keyboard', 'Button'],
    datasets: [
      {
        data: [
          overallStats?.keyboardCount || 0,
          overallStats?.buttonCount || 0,
        ],
        backgroundColor: [
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 99, 132, 0.5)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  const variantData = {
    labels: variantStats?.variantStats.map((stat: any) => stat.variant) || [],
    datasets: [
      {
        label: 'Usage Count',
        data: variantStats?.variantStats.map((stat: any) => stat.count) || [],
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      },
      {
        label: 'Avg Duration (seconds)',
        data: variantStats?.variantStats.map((stat: any) => stat.avgDuration) || [],
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
        borderColor: 'rgba(255, 159, 64, 1)',
        borderWidth: 1,
      },
    ],
  };
  
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Assistant Analytics Dashboard</h1>
        <Button onClick={refreshData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>
      
      {/* Date Range Picker */}
      <div className="mb-6">
        <h2 className="text-lg font-medium mb-2">Date Range</h2>
        <div className="flex gap-2">
          <DatePickerWithRange 
            date={dateRange} 
            setDate={setDateRange} 
          />
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            {isOverallStatsLoading ? (
              <div className="flex justify-center items-center h-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="text-2xl font-bold">{overallStats?.totalEvents || 0}</div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Keyboard Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {isOverallStatsLoading ? (
              <div className="flex justify-center items-center h-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="text-2xl font-bold">
                {overallStats?.keyboardPercentage.toFixed(1) || 0}%
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. Session Duration</CardTitle>
          </CardHeader>
          <CardContent>
            {isOverallStatsLoading ? (
              <div className="flex justify-center items-center h-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="text-2xl font-bold">
                {overallStats?.avgDuration.toFixed(1) || 0} seconds
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Charts */}
      <Tabs defaultValue="usage" className="w-full">
        <TabsList>
          <TabsTrigger value="usage">Daily Usage</TabsTrigger>
          <TabsTrigger value="source">Trigger Source</TabsTrigger>
          <TabsTrigger value="variants">Variants Performance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="usage" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Assistant Usage</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {isDailyStatsLoading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Line
                  data={dailyUsageData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="source" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Assistant Trigger Source</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              {isOverallStatsLoading ? (
                <div className="flex justify-center items-center h-80">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="h-80 w-80">
                  <Pie
                    data={triggerSourceData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="variants" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Animation Variant Performance</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {isVariantStatsLoading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : variantStats?.variantStats.length === 0 ? (
                <div className="flex justify-center items-center h-full text-muted-foreground">
                  No variant data available yet
                </div>
              ) : (
                <Bar
                  data={variantData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 