import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SkeletonCampaignBoard } from '@/components/SkeletonCampaignBoard';
import { TaskMonitorProvider } from '@/components/TaskMonitorProvider';
import { PersLMTaskMonitor } from '@/components/PersLMTaskMonitor';

export default function SkeletonBoardExample() {
  const [isLoading, setIsLoading] = useState(true);
  
  // Example PersLM tasks for implementing the skeleton loader feature
  const perslmTasks = [
    { 
      description: 'Create SkeletonCampaignBoard component', 
      status: 'completed' as const 
    },
    { 
      description: 'Update CampaignBoard to use skeleton loader', 
      status: 'completed' as const 
    },
    { 
      description: 'Add transition animations', 
      status: 'in-progress' as const 
    },
    { 
      description: 'Test skeleton loader on slow connections', 
      status: 'pending' as const 
    },
    { 
      description: 'Optimize skeleton loader performance', 
      status: 'pending' as const 
    }
  ];

  return (
    <TaskMonitorProvider persistKey="perslm-skeleton-example">
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Skeleton Board Implementation Example</h1>
          <Button 
            onClick={() => setIsLoading(!isLoading)}
            variant={isLoading ? "destructive" : "default"}
          >
            {isLoading ? "Stop Loading" : "Start Loading"}
          </Button>
        </div>
        
        <div className="border rounded-lg shadow-sm p-4 mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2">Implementation Details</h2>
            <p className="text-gray-700 mb-4">
              This example demonstrates how to use the SkeletonCampaignBoard component 
              during loading states in the CampaignBoard. The skeleton loader provides 
              a better user experience by showing a preview of the content structure
              instead of a plain loading spinner.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <h3 className="text-blue-800 font-medium mb-1">Implementation Steps:</h3>
              <ol className="list-decimal pl-5 text-blue-700">
                <li>Create a SkeletonCampaignBoard component</li>
                <li>Import it in CampaignBoard.tsx</li>
                <li>Replace the loading spinner with the skeleton loader</li>
                <li>Add smooth transitions between states</li>
              </ol>
            </div>
          </div>
          
          <div className="h-[600px] bg-gray-50 rounded border">
            {isLoading ? (
              <div className="h-full flex flex-col">
                <div className="flex justify-between items-center mb-4 p-4">
                  <h2 className="text-xl font-semibold">Campaign Board</h2>
                </div>
                <SkeletonCampaignBoard />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xl mb-2">Content Loaded!</p>
                  <p className="text-gray-500">Click "Start Loading" to see the skeleton loader again</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg border">
          <h2 className="text-lg font-semibold mb-2">Code Example:</h2>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
            {`// In CampaignBoard.tsx
import { SkeletonCampaignBoard } from './SkeletonCampaignBoard';

// Inside your component
if (isLoading) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Campaign Board</h2>
      </div>
      <SkeletonCampaignBoard />
    </div>
  );
}`}
          </pre>
        </div>
      </div>
      
      {/* PersLM Task Monitor */}
      <PersLMTaskMonitor defaultTasks={perslmTasks} />
    </TaskMonitorProvider>
  );
} 