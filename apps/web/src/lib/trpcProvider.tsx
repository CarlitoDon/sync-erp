import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { httpBatchLink, TRPCLink } from '@trpc/client';
import { trpc } from './trpc';
import hash from 'object-hash';
import { AppRouter } from '../../../api/src/trpc/router';
import { ReactNode } from 'react';
import superjson from 'superjson';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      // Cache data for 30 seconds before becoming stale
      // Prevents unnecessary refetches on navigation
      staleTime: 30_000,
      // Keep unused data in cache for 5 minutes
      gcTime: 300_000,
    },
  },
});

const idempotencyLink: TRPCLink<AppRouter> = () => {
  return ({ next, op }) => {
    if (op.type === 'mutation') {
      // Generate deterministic hash of input for idempotency
      // Ignores order of keys in object
      const inputHash = hash(op.input || {}, { algorithm: 'md5' });
      op.context.headers = {
        ...op.context.headers,
        'idempotency-key': inputHash,
      };
    }
    return next(op);
  };
};

const trpcClient = trpc.createClient({
  links: [
    idempotencyLink,
    httpBatchLink({
      url: `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/trpc`,
      // Include credentials for cookie auth
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
      headers() {
        // CompanyId header added by httpClient interceptor
        const companyId = localStorage.getItem('currentCompanyId');
        return {
          ...(companyId && { 'x-company-id': companyId }),
        };
      },
      transformer: superjson,
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
