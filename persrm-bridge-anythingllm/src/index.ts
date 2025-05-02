/**
 * PersRM Bridge for AnythingLLM
 * 
 * Bridge adapter to integrate PersRM with AnythingLLM and similar platforms.
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { startReasoning, getRecentSessions, saveFeedback } from 'persrm-core';

// Import routes
import reasonRoutes from './api/reason';
import sessionsRoutes from './api/sessions';
import feedbackRoutes from './api/feedback';

// Create Express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/reason', reasonRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/feedback', feedbackRoutes);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
  
  // Handle real-time reasoning requests
  socket.on('reason', async (data) => {
    try {
      const { query, options } = data;
      
      // Start reasoning and emit events for progress
      socket.emit('reasoning:started', { query });
      
      const result = await startReasoning(query, options);
      
      socket.emit('reasoning:completed', result);
    } catch (error) {
      socket.emit('reasoning:error', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 3100;

httpServer.listen(PORT, () => {
  console.log(`PersRM Bridge for AnythingLLM running on port ${PORT}`);
}); 