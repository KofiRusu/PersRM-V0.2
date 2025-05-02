/**
 * Reasoning API Routes
 */

import { Router } from 'express';
import { startReasoning } from 'persrm-core';

const router = Router();

/**
 * POST /api/reason
 * Start a reasoning process
 */
router.post('/', async (req, res) => {
  try {
    const { query, context, mode, saveToMemory } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const result = await startReasoning(query, {
      context,
      mode,
      saveToMemory
    });
    
    return res.json(result);
  } catch (error) {
    console.error('Error in reasoning endpoint:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

/**
 * POST /api/reason/stream
 * Start a reasoning process with streaming response
 * (Returns a 501 Not Implemented for now)
 */
router.post('/stream', (req, res) => {
  return res.status(501).json({ 
    error: 'Streaming reasoning not yet implemented' 
  });
});

export default router; 