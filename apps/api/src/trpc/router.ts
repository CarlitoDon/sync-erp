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
import { authRouter } from './routers/auth.router';
import { adminRouter } from './routers/admin.router';
import { healthRouter } from './routers/health.router';
import { expenseRouter } from './routers/expense.router';
import { inventoryRouter } from './routers/inventory.router';
import { financeRouter } from './routers/finance.router';
import { upfrontPaymentRouter } from './routers/upfrontPayment.router'; // Feature 036
import { customerDepositRouter } from './routers/customerDeposit.router'; // Cash Upfront Sales
import { cashBankRouter } from '../modules/cash-bank/cash-bank.router'; // Feature 042: Cash & Bank
import { rentalRouter } from './routers/rental.router'; // Feature 043: Rental Business
import { rentalBundleRouter } from './routers/rental-bundle.router'; // Package/Bundle support
import { publicRentalRouter } from './routers/public-rental.router'; // Santi Living Integration
export { Prisma } from '@sync-erp/database';

export const appRouter = router({
  // Public routes (no auth required)
  auth: authRouter,
  health: healthRouter,
  publicRental: publicRentalRouter, // External client access (santi-living)
  bill: billRouter,
  purchaseOrder: purchaseOrderRouter,
  invoice: invoiceRouter,
  payment: paymentRouter,
  salesOrder: salesOrderRouter,

  // Master data
  partner: partnerRouter,
  product: productRouter,

  // Operations
  inventory: inventoryRouter,
  upfrontPayment: upfrontPaymentRouter, // Feature 036: Procurement
  customerDeposit: customerDepositRouter, // Cash Upfront Sales
  rental: rentalRouter, // Feature 043: Rental Business
  rentalBundle: rentalBundleRouter, // Package/Bundle support

  // Finance & Accounting
  finance: financeRouter,
  expense: expenseRouter,
  cashBank: cashBankRouter,

  // System
  dashboard: dashboardRouter,
  user: userRouter,
  company: companyRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
