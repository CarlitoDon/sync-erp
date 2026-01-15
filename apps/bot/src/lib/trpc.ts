import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@sync-erp/api/src/trpc/router';
import superjson from 'superjson';
import dotenv from 'dotenv';

dotenv.config();

const API_URL =
  process.env.SYNC_ERP_API_URL || 'https://sync-erp-api-production.up.railway.app/api/trpc';
const API_KEY = process.env.SYNC_ERP_API_KEY || '';

console.log(`[TRPC] Connecting to API: ${API_URL}`);

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: API_URL,
      transformer: superjson,
      headers() {
        return {
          Authorization: `Bearer ${API_KEY}`,
        };
      },
    }),
  ],
});
