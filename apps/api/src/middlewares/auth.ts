import { Request, Response, NextFunction } from 'express';
import { HEADERS, ERROR_CODES } from '@sync-erp/shared';
import { AuthRepository } from '../modules/auth/auth.repository';

const authRepository = new AuthRepository();
const getSession = (sessionId: string) =>
  authRepository.getSession(sessionId);
import { prisma, type User, type Session } from '@sync-erp/database';

// Extend Express Request to include context using module augmentation
declare module 'express-serve-static-core' {
  interface Request {
    context: {
      userId?: string;
      companyId?: string;
    };
    user?: User;
    session?: Session;
  }
}

/**
 * Auth Middleware - Validates session cookie and strict company access
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sessionId = req.cookies['sessionId'];

  if (!sessionId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }

  try {
    const session = await getSession(sessionId);

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired session',
        },
      });
    }

    const userId = session.userId;
    const companyId = req.headers[HEADERS.COMPANY_ID] as
      | string
      | undefined;

    // Validate Company Access if companyId is provided (required for most routes)
    if (companyId) {
      const membership = await prisma.companyMember.findUnique({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'User does not belong to this company',
          },
        });
      }
    } else {
      // Per original index.ts, most routes require companyId.
      // However, some might not (e.g. /me).
      // The original middleware returned 400. We maintain this for now but strictly.
      // Only if the route requires it. But middleware is applied globally to /api/* usually.
      // If the route doesn't need it, we should not fail?
      // index.ts:
      // app.use('/api', authMiddleware)
      // app.use('/api/users', userRouter) -> likely needs companyId
      // The original check was strict. I will keep it strict.
      return res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `Missing required header: ${HEADERS.COMPANY_ID}`,
        },
      });
    }

    req.context = {
      userId,
      companyId,
    };
    req.user = session.user;
    req.session = session;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed',
      },
    });
  }
}

/**
 * Optional auth middleware - populates context but doesn't require it
 */
export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const sessionId = req.cookies['sessionId'];
  const companyId = req.headers[HEADERS.COMPANY_ID] as
    | string
    | undefined;

  req.context = {
    companyId,
  };

  if (!sessionId) {
    return next();
  }

  try {
    const session = await getSession(sessionId);

    if (session && session.expiresAt > new Date()) {
      req.context.userId = session.userId;
      req.user = session.user;
      req.session = session;
    }
  } catch (error) {
    console.warn('Optional auth check failed:', error);
  }

  next();
}
