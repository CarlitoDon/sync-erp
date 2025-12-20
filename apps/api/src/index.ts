import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middlewares/errorHandler';
import { optionalAuthMiddleware } from './middlewares/auth';

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

// Public Health Check (keep for load balancers)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// tRPC (mounted with OPTIONAL auth - tRPC procedures handle their own auth via protectedProcedure)
app.use(
  '/api/trpc',
  optionalAuthMiddleware,
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

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
