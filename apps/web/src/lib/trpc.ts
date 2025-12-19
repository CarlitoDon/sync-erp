import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../api/src/trpc/router';

/**
 * tRPC React hooks
 * Fully typed with backend router
 */
export const trpc: ReturnType<typeof createTRPCReact<AppRouter>> =
  createTRPCReact<AppRouter>();
