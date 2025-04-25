import { createServer } from 'http';
import { appRouter } from './router';
import { createContext } from './context';
import { createNextApiHandler } from '@trpc/server/adapters/next';

/**
 * Create API handler for Next.js API routes
 */
export const createHandler = () => {
  return createNextApiHandler({
    router: appRouter,
    createContext,
  });
};

/**
 * Create HTTP server for testing or standalone use
 */
export const server = createServer((req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Handle the tRPC API route
  if (req.url?.startsWith('/api/trpc')) {
    const handler = createHandler();
    return handler(req, res);
  }
  
  // Handle other routes
  res.writeHead(404);
  res.end('Not found');
}); 