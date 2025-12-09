import { Request, Response, NextFunction } from 'express';
import { HEADERS, ERROR_CODES } from '@sync-erp/shared';

// Extend Express Request to include context using module augmentation
declare module 'express-serve-static-core' {
  interface Request {
    context: {
      userId?: string;
      companyId?: string;
    };
  }
}

/**
 * Auth Middleware - Extracts user context from headers
 * For MVP: Simple header-based auth (no JWT validation)
 * Production: Replace with proper JWT/session validation
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const companyId = req.headers[HEADERS.COMPANY_ID] as string | undefined;
  const userId = req.headers[HEADERS.USER_ID] as string | undefined;

  // Initialize context
  req.context = {
    userId,
    companyId,
  };

  // For protected routes, require company context
  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: `Missing required header: ${HEADERS.COMPANY_ID}`,
      },
    });
  }

  next();
}

/**
 * Optional auth middleware - populates context but doesn't require it
 */
export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const companyId = req.headers[HEADERS.COMPANY_ID] as string | undefined;
  const userId = req.headers[HEADERS.USER_ID] as string | undefined;

  req.context = {
    userId,
    companyId,
  };

  next();
}
