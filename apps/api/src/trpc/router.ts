import { router } from './trpc';
import { billRouter } from './routers/bill.router';

/**
 * Root application router
 * Add new routers here as we migrate modules
 */
export const appRouter = router({
  bill: billRouter,
  // Future: purchaseOrder, invoice, payment, etc.
});

export type AppRouter = typeof appRouter;
