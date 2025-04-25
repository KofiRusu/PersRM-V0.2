import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { type AppRouter } from '../../../app/api/trpc/[trpc]/routers';

// Create TRPC react hooks
export const trpc = createTRPCReact<AppRouter>();

// Create a global QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Create TRPC client
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/api/trpc',
    }),
  ],
});

// Provider component
interface TrpcProviderProps {
  children: ReactNode;
}

export const TrpcProvider: React.FC<TrpcProviderProps> = ({ children }) => {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}; 