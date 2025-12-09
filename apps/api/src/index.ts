import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middlewares/errorHandler';
import { authMiddleware } from './middlewares/auth';
import { companyRouter } from './routes/company';
import { userRouter } from './routes/user';
import { healthRouter } from './routes/health';

const app = express();
const PORT = process.env.PORT || 3001;

// Global Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Public Routes
app.use('/health', healthRouter);

// Protected Routes (require auth context)
app.use('/api', authMiddleware);
app.use('/api/companies', companyRouter);
app.use('/api/users', userRouter);

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
