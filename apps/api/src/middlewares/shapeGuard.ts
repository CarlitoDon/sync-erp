import { Request, Response, NextFunction } from 'express';
import { BusinessShape, type Prisma } from '@sync-erp/database';

// Extend Express Request to include company (already done in auth.ts)
declare module 'express-serve-static-core' {
  interface Request {
    company?: {
      id: string;
      name: string;
      businessShape: BusinessShape;
      configs?: { key: string; value: Prisma.JsonValue }[];
    };
  }
}

/**
 * Shape Guard Middleware
 *
 * Blocks business operations when company businessShape is PENDING.
 * This ensures companies complete setup before creating any business data.
 *
 * Usage: Apply to write operation routes (POST, PUT, DELETE)
 *
 * @example
 * router.post('/products', authMiddleware, requireActiveShape(), productController.create);
 */
export function requireActiveShape() {
  return (req: Request, res: Response, next: NextFunction) => {
    // If no company in context, let other middleware handle it
    if (!req.company) {
      return next();
    }

    // Check if company shape is PENDING
    if (req.company.businessShape === BusinessShape.PENDING) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SHAPE_PENDING',
          message:
            'Operations blocked until business shape is selected. Please complete company setup.',
          action: 'COMPLETE_SETUP',
        },
      });
    }

    // Company has active shape, proceed
    next();
  };
}
