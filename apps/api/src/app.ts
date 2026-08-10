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
import { getReleaseIdentity } from './release-identity';

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
  app.use(express.json({ limit: process.env.SYNC_ERP_JSON_LIMIT || '25mb' }));

  // CSRF protection for cookie-based mutations
  app.use(csrfProtection);

  app.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Sync ERP API',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      release: getReleaseIdentity(),
      timestamp: new Date().toISOString(),
    });
  });

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

  app.use(sentryErrorMiddleware);
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
