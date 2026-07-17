import { Router } from 'express';

export function isSentryTestRouteEnabled(): boolean {
  const explicitlyEnabled = process.env.SENTRY_TEST_ROUTE_ENABLED === 'true';
  if (!explicitlyEnabled) return false;

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.HOSTINGER_ENV === 'production';

  if (!isProduction) return true;

  return process.env.SENTRY_ALLOW_PRODUCTION_TEST_ROUTE === 'true';
}

export const testSentryRouter = Router();

testSentryRouter.get('/test-error', () => {
  throw new Error('Sentry test error from Sync ERP API');
});
