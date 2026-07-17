import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { httpBatchLink, TRPCLink, type Operation } from '@trpc/client';
import { trpc } from './trpc';
import hash from 'object-hash';
import type { AppRouter } from '../../../api/src/trpc/router';
import { ReactNode } from 'react';
import superjson from 'superjson';
import {
  CSRF_HEADER_NAME,
  buildApiRequestHeaders,
  ensureCsrfToken,
  type HeaderRecord,
} from './csrf';

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
        ...mergeContextHeaders({}, op.context.headers),
        'idempotency-key': inputHash,
      };
    }
    return next(op);
  };
};

const trpcUrl = `${import.meta.env.VITE_SYNC_ERP_API_URL || 'http://localhost:3001/api/trpc'}`;

type BuildTrpcHeadersOptions = {
  trpcUrl: string;
  opList: Operation[];
  cookieString?: string;
  fetchFn?: Parameters<typeof ensureCsrfToken>[2];
  storage?: Pick<Storage, 'getItem'>;
};

function mergeContextHeaders(
  target: HeaderRecord,
  contextHeaders: unknown
): HeaderRecord {
  if (!contextHeaders) {
    return target;
  }

  if (Array.isArray(contextHeaders)) {
    for (const entry of contextHeaders) {
      if (!Array.isArray(entry) || entry.length !== 2) {
        continue;
      }

      const [key, value] = entry;
      if (typeof key === 'string' && typeof value === 'string') {
        target[key] = value;
      }
    }
    return target;
  }

  if (typeof contextHeaders === 'object') {
    for (const [key, value] of Object.entries(contextHeaders)) {
      if (typeof value === 'string') {
        target[key] = value;
      }
    }
  }

  return target;
}

export async function buildTrpcHeaders({
  trpcUrl,
  opList,
  cookieString,
  fetchFn,
  storage = globalThis.localStorage,
}: BuildTrpcHeadersOptions): Promise<HeaderRecord> {
  let headers: HeaderRecord = buildApiRequestHeaders(trpcUrl);

  for (const op of opList) {
    headers = mergeContextHeaders(headers, op.context.headers);
  }

  const companyId = storage.getItem('currentCompanyId');
  if (companyId) {
    headers['x-company-id'] = companyId;
  }

  const hasMutation = opList.some((op) => op.type === 'mutation');

  if (hasMutation) {
    const csrfToken = await ensureCsrfToken(trpcUrl, cookieString, fetchFn);
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  return headers;
}

const trpcClient = trpc.createClient({
  links: [
    idempotencyLink,
    httpBatchLink({
      url: trpcUrl,
      // Include credentials for cookie auth
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
      async headers({ opList }) {
        return buildTrpcHeaders({ trpcUrl, opList });
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
