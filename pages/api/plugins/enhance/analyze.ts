import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { PluginEnhancer } from '@/plugins/ui/plugin_enhancer';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * API handler for running plugin analysis
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Run the CLI command
    const { stdout, stderr } = await execAsync('npm run enhance-plugins:analyze');
    
    if (stderr && !stderr.includes('npm')) {
      console.error('Error running analysis:', stderr);
      return res.status(500).json({ error: 'Analysis failed', details: stderr });
    }
    
    // Success response
    return res.status(200).json({ 
      success: true, 
      message: 'Analysis completed successfully',
      output: stdout
    });
  } catch (error) {
    console.error('Error running analysis:', error);
    return res.status(500).json({ 
      error: 'Analysis failed', 
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 