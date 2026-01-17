import './env';
import './di-setup';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middlewares/errorHandler';
import { optionalAuthMiddleware } from './middlewares/auth';
import { correlationMiddleware } from './middlewares/correlation';

import cookieParser from 'cookie-parser';

// tRPC
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';

// DI Container - register all services on startup
// DI Container - register all services on startup
import { registerServices } from './modules/common/di';
registerServices();

const app = express();
const PORT = process.env.PORT || 3001;

// Global Middleware
app.use(helmet());
app.use(correlationMiddleware); // Request tracing
app.use(cookieParser());
// CORS origin configuration - supports multiple origins and Vercel previews
const getCorsOrigin = ():
  | string
  | string[]
  | ((
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => void) => {
  const corsOrigin =
    process.env.CORS_ORIGIN || 'http://localhost:5173';

  // If comma-separated, split into array
  const origins = corsOrigin.split(',').map((o) => o.trim());

  // Custom origin checker function to support Vercel preview URLs
  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Check if origin matches any allowed origin
    if (origins.includes(origin)) {
      callback(null, true);
      return;
    }

    // Allow Vercel deployments (production and preview)
    if (origin.endsWith('.vercel.app')) {
      callback(null, true);
      return;
    }

    // Allow localhost for development
    if (origin.startsWith('http://localhost:')) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  };
};

app.use(
  cors({
    origin: getCorsOrigin(),
    credentials: true,
  })
);
app.use(express.json());

// Root Health Check
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Sync ERP API',
    timestamp: new Date().toISOString(),
  });
});

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

const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.warn(`🚀 Sync ERP API running on http://0.0.0.0:${PORT}`);
});

// Graceful shutdown to prevent zombie processes
const gracefulShutdown = (signal: string) => {
  console.warn(`\n[${signal}] Shutting down gracefully...`);
  server.close(() => {
    console.warn('[API] Server closed successfully.');
    process.exit(0);
  });
  // Force exit after 5s if server doesn't close
  setTimeout(() => process.exit(1), 5000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default app;
