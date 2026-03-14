import './env';
import './di-setup';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as trpcExpress from '@trpc/server/adapters/express';
import { errorHandler } from './middlewares/errorHandler';
import { optionalAuthMiddleware } from './middlewares/auth';
import { correlationMiddleware } from './middlewares/correlation';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';
import { publicRentalRouter } from './trpc/routers/public-rental.router';

// CORS origin configuration - supports multiple origins and Vercel previews
const getCorsOrigin = ():
  | string
  | string[]
  | ((
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => void) => {
  const corsOrigin =
    process.env.CORS_ORIGIN ||
    process.env.CORS_ALLOWED_ORIGINS ||
    'http://localhost:5173';

  const origins = corsOrigin.split(',').map((o) => o.trim());

  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (origins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (
      origin &&
      (origin.endsWith('.vercel.app') ||
        origin === 'https://sync-erp.vercel.app')
    ) {
      callback(null, true);
      return;
    }

    if (origin.startsWith('http://localhost:')) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  };
};

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(correlationMiddleware);
  app.use(cookieParser());
  app.use(
    cors({
      origin: getCorsOrigin(),
      credentials: true,
    })
  );
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Sync ERP API',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Dedicated publicRental mount for external clients using the sub-router contract
  app.use(
    '/api/trpc/publicRental',
    optionalAuthMiddleware,
    trpcExpress.createExpressMiddleware({
      router: publicRentalRouter,
      createContext,
    })
  );

  app.use(
    '/api/trpc',
    optionalAuthMiddleware,
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.use(errorHandler);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    });
  });

  return app;
}
