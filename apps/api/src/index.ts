import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middlewares/errorHandler';
import { authMiddleware } from './middlewares/auth';
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

const app = express();
const PORT = process.env.PORT || 3001;

// Global Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

// Public Routes
app.use('/health', healthRouter);

// Protected Routes (require auth context)
app.use('/api', authMiddleware);
app.use('/api/companies', companyRouter);
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
