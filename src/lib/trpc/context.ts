import { CreateNextContextOptions } from '@trpc/server/adapters/next';

/**
 * Context for tRPC API
 */
export async function createContext({ req, res }: CreateNextContextOptions) {
  return {
    req,
    res,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>; 