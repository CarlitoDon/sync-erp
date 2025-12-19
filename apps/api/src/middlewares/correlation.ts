// Correlation ID Middleware
// Extracts or generates correlation ID for request tracing (FR-010.1)
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

const CORRELATION_HEADER = 'X-Correlation-Id';

/**
 * Extend Express Request to include correlationId
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

/**
 * Middleware to extract or generate correlation ID for each request.
 * The correlation ID links Audit Logs to Saga Logs for traceability.
 */
export function correlationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract from header or generate new UUID
  const correlationId =
    (req.headers[CORRELATION_HEADER.toLowerCase()] as string) ||
    randomUUID();

  // Attach to request for downstream use
  req.correlationId = correlationId;

  // Echo back in response for client-side tracking
  res.setHeader(CORRELATION_HEADER, correlationId);

  next();
}
