import { NextFunction, Request, Response } from 'express';
import { Sentry, isSentryConfigured } from '../instrument';

type ErrorWithStatus = Error & {
  statusCode?: number;
  status?: number;
  code?: string;
};

function getStatusCode(err: ErrorWithStatus): number {
  return err.statusCode || err.status || 500;
}

function shouldCaptureError(err: ErrorWithStatus): boolean {
  return getStatusCode(err) >= 500;
}

export function sentryErrorMiddleware(
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!isSentryConfigured() || !shouldCaptureError(err)) {
    next(err);
    return;
  }

  const eventId = Sentry.withScope((scope) => {
    scope.setTag('correlation_id', req.correlationId);
    scope.setTag('http_status', String(getStatusCode(err)));

    if (err.code) {
      scope.setTag('error_code', err.code);
    }

    if (req.context?.userId) {
      scope.setUser({ id: req.context.userId });
    }

    scope.setContext('request', {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      correlationId: req.correlationId,
      companyId: req.context?.companyId,
    });

    return Sentry.captureException(err);
  });

  if (!res.headersSent) {
    res.setHeader('X-Sentry-Event-Id', eventId);
  }

  next(err);
}
