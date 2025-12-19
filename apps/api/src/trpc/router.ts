import { router } from './trpc';
import { billRouter } from './routers/bill.router';
import { purchaseOrderRouter } from './routers/purchaseOrder.router';
import { invoiceRouter } from './routers/invoice.router';
import { paymentRouter } from './routers/payment.router';
import { salesOrderRouter } from './routers/salesOrder.router';
import { partnerRouter } from './routers/partner.router';
import { productRouter } from './routers/product.router';
import { dashboardRouter } from './routers/dashboard.router';
import { userRouter } from './routers/user.router';
import { companyRouter } from './routers/company.router';

/**
 * Root application router
 * All module routers combined here
 */
export const appRouter = router({
  // Accounting
  bill: billRouter,
  invoice: invoiceRouter,
  payment: paymentRouter,

  // Procurement & Sales
  purchaseOrder: purchaseOrderRouter,
  salesOrder: salesOrderRouter,

  // Master Data
  partner: partnerRouter,
  product: productRouter,

  // System
  dashboard: dashboardRouter,
  user: userRouter,
  company: companyRouter,
});

export type AppRouter = typeof appRouter;
