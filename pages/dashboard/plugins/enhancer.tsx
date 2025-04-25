import { useState, useEffect } from 'react';
import { PrismaClient } from '@prisma/client';
import { EnhancementDashboard } from '@/plugins/ui/reports/EnhancementDashboard';
import { getTrainingDataSummary } from '@/plugins/ui/plugin-enhancer.schema';

export async function getServerSideProps() {
  const prisma = new PrismaClient();
  
  try {
    // Get the latest report
    const latestReport = await prisma.pluginEnhancerReport.findFirst({
      orderBy: {
        timestamp: 'desc'
      },
      include: {
        globalSuggestions: true,
        analyses: {
          include: {
            suggestions: true
          }
        }
      }
    });
    
    // Get model comparisons
    const modelComparisons = await prisma.modelComparison.findMany({
      where: {
        trainingSessionId: null // Get comparisons not associated with training
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 50
    });
    
    // Get training data
    const trainingData = {
      reports: await prisma.pluginEnhancerReport.findMany({
        orderBy: { 
          timestamp: 'desc' 
        },
        take: 10,
        include: {
          _count: {
            select: { 
              globalSuggestions: true,
              analyses: true,
              training: true 
            }
          }
        }
      }),
      analyses: await prisma.pluginAnalysis.findMany({
        orderBy: { 
          id: 'desc' 
        },
        take: 20,
        include: {
          suggestions: true
        }
      }),
      comparisons: await prisma.modelComparison.findMany({
        orderBy: { 
          timestamp: 'desc' 
        },
        take: 50
      }),
      learnings: await prisma.trainingLearning.findMany({
        orderBy: { 
          timestamp: 'desc' 
        },
        take: 20
      })
    };
    
    // Get summary data
    const summary = await getTrainingDataSummary(prisma);
    
    return {
      props: {
        report: latestReport ? JSON.parse(JSON.stringify(latestReport)) : null,
        modelComparisons: JSON.parse(JSON.stringify(modelComparisons)),
        trainingData: JSON.parse(JSON.stringify(trainingData)),
        summary: JSON.parse(JSON.stringify(summary)),
      }
    };
  } catch (error) {
    console.error('Error fetching plugin enhancer data:', error);
    return {
      props: {
        error: 'Failed to load plugin enhancer data',
        report: null,
        modelComparisons: [],
        trainingData: null,
        summary: null
      }
    };
  } finally {
    await prisma.$disconnect();
  }
}

export default function PluginEnhancerDashboard({ 
  report, 
  modelComparisons = [],
  trainingData,
  summary,
  error
}: {
  report: any;
  modelComparisons: any[];
  trainingData: any;
  summary: any;
  error?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Add model comparisons to the report if they exist
  const enhancedReport = report ? {
    ...report,
    modelComparisons
  } : null;
  
  const runAnalysis = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/plugins/enhance/analyze', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to run analysis');
      }
      
      // Reload the page to get the new data
      window.location.reload();
    } catch (error) {
      console.error('Error running analysis:', error);
      setIsLoading(false);
    }
  };
  
  const runTraining = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/plugins/enhance/train', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to run training');
      }
      
      // Reload the page to get the new data
      window.location.reload();
    } catch (error) {
      console.error('Error running training:', error);
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Plugin Enhancer Dashboard</h1>
        <div className="flex gap-4">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            onClick={runAnalysis}
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Run Analysis'}
          </button>
          <button
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            onClick={runTraining}
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Run Training'}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}
      
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-2">Total Sessions</h2>
            <p className="text-3xl font-bold">{summary.totalSessions}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-2">Total Learnings</h2>
            <p className="text-3xl font-bold">{summary.totalLearnings}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-2">Success Rate</h2>
            <p className="text-3xl font-bold">{summary.successRate.toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-2">Average Improvement</h2>
            <p className="text-3xl font-bold">{summary.averageInitImprovement.toFixed(1)}%</p>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow">
        <EnhancementDashboard 
          report={enhancedReport} 
          trainingData={trainingData}
          isLoading={isLoading} 
          onRefresh={runAnalysis} 
        />
      </div>
    </div>
  );
} 