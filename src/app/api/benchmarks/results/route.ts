import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const resultsDir = path.join(process.cwd(), 'benchmark-results');
    
    // Get all files in the directory
    const files = await fs.readdir(resultsDir);
    
    // Find the most recent JSON results file
    const resultFiles = files.filter(file => 
      file.startsWith('model-comparison-results') && file.endsWith('.json')
    );
    
    if (resultFiles.length === 0) {
      // Return mock data for initial render when no results exist yet
      return NextResponse.json({
        success: true,
        results: {
          models: {
            "GPT-4o": {
              totalTime: 19677,
              successCount: 5,
              failCount: 0,
              avgResponseTime: 3935.4,
              avgCodeLength: 973.6,
              successRate: 100
            },
            "GPT-3.5 Turbo": {
              totalTime: 8900,
              successCount: 5,
              failCount: 0,
              avgResponseTime: 1780,
              avgCodeLength: 735.6,
              successRate: 100
            },
            "DeepSeek Chat": {
              totalTime: 22021,
              successCount: 5,
              failCount: 0,
              avgResponseTime: 4404.2,
              avgCodeLength: 879.6,
              successRate: 100
            }
          },
          prompts: {
            "Button Component": {
              results: {
                "GPT-4o": { responseTime: 4753, codeLength: 881, success: true },
                "GPT-3.5 Turbo": { responseTime: 1679, codeLength: 775, success: true },
                "DeepSeek Chat": { responseTime: 4810, codeLength: 879, success: true }
              },
              bestModel: "GPT-3.5 Turbo",
              worstModel: "DeepSeek Chat"
            },
            "Form Validation": {
              results: {
                "GPT-4o": { responseTime: 3684, codeLength: 1015, success: true },
                "GPT-3.5 Turbo": { responseTime: 1752, codeLength: 749, success: true },
                "DeepSeek Chat": { responseTime: 3235, codeLength: 913, success: true }
              },
              bestModel: "GPT-3.5 Turbo",
              worstModel: "GPT-4o"
            }
          }
        },
        isMockData: true
      });
    }
    
    // Sort files by date (most recent first)
    resultFiles.sort().reverse();
    
    // Read the most recent file
    const latestResultFile = resultFiles[0];
    const resultsPath = path.join(resultsDir, latestResultFile);
    const fileContent = await fs.readFile(resultsPath, 'utf-8');
    const results = JSON.parse(fileContent);
    
    return NextResponse.json({ 
      success: true,
      results,
      timestamp: new Date().toISOString(),
      fileName: latestResultFile
    });
  } catch (error) {
    console.error('Failed to fetch benchmark results:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch benchmark results' },
      { status: 500 }
    );
  }
} 