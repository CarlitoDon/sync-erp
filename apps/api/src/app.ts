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
<<<<<<< HEAD
import { csrfProtection } from './middlewares/csrf';
import { sentryErrorMiddleware } from './middlewares/sentry';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';
import { integrationV1Router } from './trpc/routers/integration-v1.router';
import { integrationV1HttpRouter } from './routes/integration-v1.router';
import {
  isSentryTestRouteEnabled,
  testSentryRouter,
} from './routes/test-sentry.router';
import { googleOAuthRouter } from './modules/auth/google-oauth.router';
import { mcpRouter } from './modules/mcp/router';
import { billingHttpRouter } from './modules/billing/billing-http.router';
import { attachmentHttpRouter } from './modules/attachment/attachment-http.router';
import { getCorsOrigin } from './cors';
=======
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';
import { publicRentalRouter } from './trpc/routers/public-rental.router';
import { googleOAuthRouter } from './modules/auth/google-oauth.router';
import { mcpRouter } from './modules/mcp/router';
import { billingHttpRouter } from './modules/billing/billing-http.router';

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
>>>>>>> origin/dev

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(correlationMiddleware);
  app.use(cookieParser());
  app.use(
    cors({
      origin: getCorsOrigin(),
      credentials: true,
    })
  );
<<<<<<< HEAD
  app.use(express.json({ limit: process.env.SYNC_ERP_JSON_LIMIT || '25mb' }));

  // CSRF protection for cookie-based mutations
  app.use(csrfProtection);
=======
  app.use(express.json());
>>>>>>> origin/dev

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

<<<<<<< HEAD
  if (isSentryTestRouteEnabled()) {
    app.use('/internal/observability', testSentryRouter);
  }

  // CSRF token endpoint - client fetches this on initial load
  app.get('/api/csrf-token', (req, res) => {
    const csrfToken = (req as express.Request & { csrfToken?: string }).csrfToken;
    res.json({ csrfToken: csrfToken || null });
  });

  app.use('/mcp', mcpRouter);
  app.use('/api/auth/google', googleOAuthRouter);
  app.use('/api/billing', billingHttpRouter);
  app.use('/api/attachments', attachmentHttpRouter);
  app.use('/api/v1', integrationV1HttpRouter);

  // Dedicated tRPC mount for typed external integrations.
  app.use(
    '/api/trpc/integration/v1',
    optionalAuthMiddleware,
    trpcExpress.createExpressMiddleware({
      router: integrationV1Router,
=======
  app.use('/mcp', mcpRouter);
  app.use('/api/auth/google', googleOAuthRouter);
  app.use('/api/billing', billingHttpRouter);

  // Dedicated publicRental mount for external clients using the sub-router contract
  app.use(
    '/api/trpc/publicRental',
    optionalAuthMiddleware,
    trpcExpress.createExpressMiddleware({
      router: publicRentalRouter,
>>>>>>> origin/dev
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

<<<<<<< HEAD
  app.use(sentryErrorMiddleware);
=======
>>>>>>> origin/dev
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
