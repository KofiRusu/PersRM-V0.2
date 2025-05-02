import React from 'react';
import { TaskMonitorProvider } from '@/components/TaskMonitorProvider';
import { PersLMTaskMonitor } from '@/components/PersLMTaskMonitor';
import { Card } from '@/components/ui/card';
import Head from 'next/head';

export default function TaskMonitorDemo() {
  // Phase 2 implementation tasks with tags and priorities
  const phase2Tasks = [
    { 
      description: 'Add skeleton loaders', 
      status: 'completed' as const,
      tags: ['UI', 'UX', 'Phase 2'],
      priority: 'medium' as const 
    },
    { 
      description: 'Implement batch selection system', 
      status: 'in-progress' as const,
      tags: ['Feature', 'UX', 'Phase 2'],
      priority: 'high' as const 
    },
    { 
      description: 'Create tag autocomplete', 
      status: 'pending' as const,
      tags: ['UI', 'Phase 2'],
      priority: 'medium' as const 
    },
    { 
      description: 'Add undo toast notifications', 
      status: 'pending' as const,
      tags: ['UI', 'UX', 'Phase 2'],
      priority: 'low' as const 
    },
    { 
      description: 'Implement calendar drag-to-create', 
      status: 'pending' as const,
      tags: ['Feature', 'Calendar', 'Phase 2'],
      priority: 'high' as const 
    },
    { 
      description: 'Add campaign metrics dashboard', 
      status: 'pending' as const,
      tags: ['Feature', 'Analytics', 'Phase 2'],
      priority: 'medium' as const 
    },
    { 
      description: 'Improve keyboard shortcuts', 
      status: 'pending' as const,
      tags: ['Accessibility', 'Phase 2'],
      priority: 'low' as const 
    },
    { 
      description: 'Optimize performance for large datasets', 
      status: 'pending' as const,
      tags: ['Performance', 'Phase 2'],
      priority: 'high' as const 
    },
    { 
      description: 'Add offline capabilities', 
      status: 'pending' as const,
      tags: ['Feature', 'Performance', 'Phase 2'],
      priority: 'medium' as const 
    },
    { 
      description: 'Implement client-side caching', 
      status: 'pending' as const,
      tags: ['Performance', 'Phase 2'],
      priority: 'medium' as const 
    }
  ];

  return (
    <>
      <Head>
        <title>PersLM Task Monitor Demo</title>
        <meta name="description" content="Enhanced PersLM Task Monitor with advanced features" />
      </Head>
      
      <TaskMonitorProvider persistKey="perslm-demo">
        <div className="container mx-auto py-8 px-4">
          <h1 className="text-3xl font-bold mb-6">PersLM Task Monitor Demo</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Enhanced Task Monitor</h2>
              <p className="mb-4">
                The enhanced Task Monitor includes several new features:
              </p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Batch selection and operations for multiple tasks</li>
                <li>Task priorities (low, medium, high)</li>
                <li>Tags for better organization</li>
                <li>Detailed task information and editing</li>
                <li>Task filtering and search</li>
                <li>Enhanced statistics and metrics</li>
              </ul>
              <p>
                The monitor also includes smooth animations, toast notifications, and 
                accessibility improvements for a better user experience.
              </p>
            </Card>
            
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Phase 2 Implementation</h2>
              <p className="mb-4">
                The tasks shown represent the Phase 2 implementation plan for the Campaign Planner,
                focusing on advanced UI features, batch operations, and UX improvements.
              </p>
              <p className="mb-4">
                All tasks include tags, priorities, and can have additional details added.
                Try clicking on a task's menu (three dots) to see full details and edit options.
              </p>
              <p>
                Progress is automatically saved to your browser's localStorage, so you can return to this page
                later and continue tracking implementation progress.
              </p>
            </Card>
          </div>
          
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 mb-8">
            <h2 className="text-xl font-semibold text-blue-800 mb-4">New Features</h2>
            <ol className="list-decimal pl-5 space-y-3 text-blue-900">
              <li>
                <strong>Batch operations:</strong> Use checkboxes to select multiple tasks and change their status all at once
              </li>
              <li>
                <strong>Task filtering:</strong> Use the filter button to show only certain task statuses
              </li>
              <li>
                <strong>Task search:</strong> Search for specific tasks using the search box
              </li>
              <li>
                <strong>Task details:</strong> Click the three dots menu to view and edit task details, tags, and priority
              </li>
              <li>
                <strong>Statistics tab:</strong> View detailed metrics about your tasks and progress
              </li>
            </ol>
          </div>
        </div>
        
        {/* PersLM Task Monitor */}
        <PersLMTaskMonitor defaultTasks={phase2Tasks} />
      </TaskMonitorProvider>
    </>
  );
} 