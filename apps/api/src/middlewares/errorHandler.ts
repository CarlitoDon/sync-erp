import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ERROR_CODES } from '@sync-erp/shared';

// Type for error details - validation errors or key-value pairs
export type ErrorDetails =
  | { path: string; message: string }[]
  | Record<string, string | string[]>
  | string;

// Custom error class for application errors
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: ErrorDetails;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = ERROR_CODES.INTERNAL_ERROR,
    details?: ErrorDetails
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Helper to get user-friendly message for Prisma errors
function getPrismaErrorMessage(
  error: { code?: string; message?: string }
): string {
  switch (error.code) {
    case 'P2002':
      return 'A record with this value already exists';
    case 'P2003':
      return 'Referenced record not found';
    case 'P2025':
      return 'Record not found';
    case 'P1001':
      return 'Cannot connect to database';
    case 'P1002':
      return 'Database connection timed out';
    case 'P2021':
    case 'P2022':
      // Table/column does not exist - likely missing migration
      return 'Database schema is out of sync. Please contact support.';
    default:
      return 'Database operation failed';
  }
}

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Handle Prisma known request errors (constraint violations, not found, etc.)
  // Check for Prisma error codes (duck typing since error classes aren't exported)
  if (
    'code' in (err as unknown as Record<string, unknown>) &&
    typeof (err as unknown as Record<string, unknown>).code === 'string'
  ) {
    const prismaErr = (err as unknown as Record<string, unknown>) as { code: string };
    console.error(
      '[ErrorHandler] Prisma Error:',
      prismaErr.code,
      (err as Error).message
    );
    // eslint-disable-next-line @sync-erp/no-hardcoded-enum -- Prisma error code, not database enum
    const statusCode = prismaErr.code === 'P2025' ? 404 : 400;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: ERROR_CODES.DATABASE_ERROR || 'DATABASE_ERROR',
        message: getPrismaErrorMessage(prismaErr),
      },
    });
  }

  // Handle Prisma validation errors (check for validation error message)
  if (
    err.message &&
    err.message.includes('The provided value for the column is too long')
  ) {
    console.error('Prisma Validation Error:', err.message);
    return res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid database operation',
      },
    });
  }

  // Handle Prisma initialization errors (connection issues)
  if (
    err.message &&
    (err.message.includes('Can\'t reach database server') ||
      err.message.includes('Database connection'))
  ) {
    console.error('Prisma Initialization Error:', err.message);
    return res.status(503).json({
      success: false,
      error: {
        code: ERROR_CODES.DATABASE_ERROR || 'DATABASE_ERROR',
        message: 'Database service unavailable',
      },
    });
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  // Handle known application errors
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const errorCode = isAppError
    ? err.code
    : ERROR_CODES.INTERNAL_ERROR;
  const details = isAppError ? err.details : undefined;

  // Log server errors
  if (statusCode >= 500) {
    console.error('Server Error:', err);
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'An unexpected error occurred',
      details,
    },
  });
}

// Common error factories
export const NotFoundError = (
  message: string = 'Resource not found'
) => new AppError(message, 404, ERROR_CODES.NOT_FOUND);

export const ValidationError = (
  message: string,
  details?: ErrorDetails
) =>
  new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, details);

export const UnauthorizedError = (message: string = 'Unauthorized') =>
  new AppError(message, 401, ERROR_CODES.UNAUTHORIZED);

export const ForbiddenError = (message: string = 'Forbidden') =>
  new AppError(message, 403, ERROR_CODES.FORBIDDEN);

export const ConflictError = (message: string) =>
  new AppError(message, 409, ERROR_CODES.CONFLICT);
