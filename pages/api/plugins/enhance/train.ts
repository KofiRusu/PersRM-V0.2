import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { PluginEnhancer } from '@/plugins/ui/plugin_enhancer';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * API handler for running plugin training
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
    // Get training parameters from request
    const { iterations = 5, baseline = 'baseline', experimental = 'experimental' } = req.body;
    
    // Run the CLI command
    const command = `npm run enhance-plugins:train -- -i ${iterations} -b ${baseline} -e ${experimental}`;
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('npm')) {
      console.error('Error running training:', stderr);
      return res.status(500).json({ error: 'Training failed', details: stderr });
    }
    
    // Success response
    return res.status(200).json({ 
      success: true, 
      message: 'Training completed successfully',
      output: stdout
    });
  } catch (error) {
    console.error('Error running training:', error);
    return res.status(500).json({ 
      error: 'Training failed', 
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 