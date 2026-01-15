import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@sync-erp/api/src/trpc/router';
import superjson from 'superjson';
import dotenv from 'dotenv';
import https from 'https';
import { EnvironmentValidator } from '@sync-erp/shared';

dotenv.config();

// Log environment config on startup
EnvironmentValidator.logConfiguration();

const API_URL = EnvironmentValidator.getApiUrl(
  process.env.NODE_ENV === 'production'
    ? 'https://sync-erp-api-production.up.railway.app/api/trpc'
    : 'http://localhost:3001/api/trpc'
);

const API_KEY = EnvironmentValidator.getAuthSecret('dev_bot_secret_key_2026');

// Custom fetch with better SSL handling
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    // Use https agent if URL is HTTPS
    if (typeof input === 'string' && input.startsWith('https://')) {
      const agent = new https.Agent({
        rejectUnauthorized: process.env.NODE_ENV === 'production',
        timeout: 15000,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return fetch(input, { ...init, agent, timeout: 15000 } as any);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return fetch(input, { ...init, timeout: 15000 } as any);
  } catch (error) {
    // eslint-disable-next-line no-console
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
