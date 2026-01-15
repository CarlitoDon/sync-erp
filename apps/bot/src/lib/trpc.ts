import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@sync-erp/api/src/trpc/router';
import superjson from 'superjson';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const API_URL =
  process.env.SYNC_ERP_API_URL || 'https://sync-erp-api-production.up.railway.app/api/trpc';
const API_KEY = process.env.SYNC_ERP_API_KEY || '';

console.log(`[TRPC] Connecting to API: ${API_URL}`);

// Custom fetch with better SSL handling
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    // Use https agent if URL is HTTPS
    if (typeof input === 'string' && input.startsWith('https://')) {
      const agent = new https.Agent({
        rejectUnauthorized: process.env.NODE_ENV === 'production',
        timeout: 15000,
      });
      return fetch(input, { ...init, agent, timeout: 15000 } as any);
    }
    return fetch(input, { ...init, timeout: 15000 } as any);
  } catch (error) {
    console.error('[TRPC] Fetch error:', error);
    throw error;
  }
};

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: API_URL,
      transformer: superjson,
      fetch: customFetch,
      headers() {
        return {
          Authorization: `Bearer ${API_KEY}`,
        };
      },
    }),
  ],
});
