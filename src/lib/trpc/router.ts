import { router } from './trpc';
import { assistantLogRouter } from './routers/assistantLogRouter';

/**
 * Main app router
 */
export const appRouter = router({
  assistantLog: assistantLogRouter,
});

/**
 * Export type definition of API
 */
export type AppRouter = typeof appRouter; 