import { NextRequest } from 'next/server';
import { createHandler } from '@/lib/trpc/server';

/**
 * API handler for tRPC
 */
const handler = createHandler();

/**
 * Export handlers for Next.js App Router
 */
export { handler as GET, handler as POST }; 