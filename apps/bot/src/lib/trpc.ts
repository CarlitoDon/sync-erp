import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@sync-erp/api/src/trpc/router';
import superjson from 'superjson';
import dotenv from 'dotenv';
import https from 'https';
import { createEnvValidator } from '@sync-erp/shared';

dotenv.config();

// Create environment validator for bot service
const env = createEnvValidator('bot');

// Log environment config on startup
env.logConfiguration();

const API_URL = env.getApiUrl();

const API_KEY = env.getApiSecret();

// Custom fetch with better SSL handling
const customFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit
) => {
  try {
    // Use https agent if URL is HTTPS
    if (typeof input === 'string' && input.startsWith('https://')) {
      const agent = new https.Agent({
        rejectUnauthorized: process.env.NODE_ENV === 'production',
        timeout: 15000,
      });
      return fetch(input, { ...init, agent, timeout: 15000 } as RequestInit & { agent: typeof agent; timeout: number });
    }
    return fetch(input, { ...init, timeout: 15000 } as RequestInit & { timeout: number });
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
