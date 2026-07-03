import { Request, Response, NextFunction } from 'express';
import {
  requestContext,
  RequestContext,
} from '@sync-erp/database';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
  }
}

export function alsMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const ctx: RequestContext = {
    userId: req.context?.userId || 'system',
    companyId: req.context?.companyId || 'unknown',
    correlationId: req.correlationId,
  };

  requestContext.run(ctx, () => next());
}
