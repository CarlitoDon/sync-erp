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
import { integrationV1Router } from './routers/integration-v1.router';
import { publicRentalRouter } from './routers/public-rental.router';
import { apiKeyRouter } from './routers/api-key.router'; // Multi-tenant API key management
import { integrationRouter } from './routers/integration.router'; // Integrations Marketplace
import { botRouter } from './routers/bot.router';
import { paymentMethodRouter } from './routers/payment-method.router'; // Company payment methods
import { billingRouter } from './routers/billing.router';
import { onboardingRouter } from './routers/onboarding.router';
import { attachmentRouter } from './routers/attachment.router';
export { Prisma } from '@sync-erp/database';

export const appRouter = router({
  // Public routes (no auth required)
  auth: authRouter,
  health: healthRouter,
  integrationV1: integrationV1Router,
  publicRental: publicRentalRouter, // Deprecated compatibility alias for older typed integrations.
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
  paymentMethod: paymentMethodRouter, // Company payment methods CRUD
  billing: billingRouter, // Subscription plans, pricing, and usage limits

  // System
  dashboard: dashboardRouter,
  user: userRouter,
  company: companyRouter,
  onboarding: onboardingRouter,
  attachment: attachmentRouter,
  admin: adminRouter,
  apiKey: apiKeyRouter, // Multi-tenant API key management
  integration: integrationRouter, // Integrations Marketplace
  bot: botRouter,
});

export type AppRouter = typeof appRouter;
