import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middlewares/errorHandler';
import {
  authMiddleware,
  optionalAuthMiddleware,
} from './middlewares/auth';
import { companyRouter } from './routes/company';
import { userRouter } from './routes/user';
import { healthRouter } from './routes/health';
import { partnerRouter } from './routes/partner';
import { productRouter } from './routes/product';
import { purchaseOrderRouter } from './routes/purchaseOrder';
import { inventoryRouter } from './routes/inventory';
import { billRouter } from './routes/bill';
import { salesOrderRouter } from './routes/salesOrder';
import { invoiceRouter } from './routes/invoice';
import { paymentRouter } from './routes/payment';
import { financeRouter } from './routes/finance';
import { authRouter } from './routes/auth';
import { dashboardRouter } from './routes/dashboard';
import { adminRouter } from './routes/admin';

import cookieParser from 'cookie-parser';

// tRPC
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';

const app = express();
const PORT = process.env.PORT || 3001;

// Global Middleware
app.use(helmet());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

// Public Routes
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);

// tRPC (mounted with auth middleware)
app.use(
  '/api/trpc',
  authMiddleware,
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Protected Routes (require auth context)
// Companies route uses optional auth (doesn't require companyId)
app.use('/api/companies', optionalAuthMiddleware, companyRouter);

// All other API routes require companyId
app.use('/api', authMiddleware);
app.use('/api/users', userRouter);
app.use('/api/partners', partnerRouter);
app.use('/api/products', productRouter);
app.use('/api/purchase-orders', purchaseOrderRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/bills', billRouter);
app.use('/api/sales-orders', salesOrderRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/finance', financeRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin', adminRouter);

// Global Error Handler
app.use(errorHandler);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found',
    },
  });
});

app.listen(PORT, () => {
  console.warn(`🚀 Sync ERP API running on http://localhost:${PORT}`);
});

export default app;
