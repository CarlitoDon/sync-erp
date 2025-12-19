import { router } from './trpc';
import { billRouter } from './routers/bill.router';
import { purchaseOrderRouter } from './routers/purchaseOrder.router';
import { invoiceRouter } from './routers/invoice.router';
import { paymentRouter } from './routers/payment.router';

/**
 * Root application router
 * All module routers combined here
 */
export const appRouter = router({
  bill: billRouter,
  purchaseOrder: purchaseOrderRouter,
  invoice: invoiceRouter,
  payment: paymentRouter,
});

export type AppRouter = typeof appRouter;
