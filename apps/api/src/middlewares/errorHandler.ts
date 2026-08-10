import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { DomainError, ERROR_CODES } from '@sync-erp/shared';

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

/**
 * Prisma error codes produced by the generated client for known request
 * failures. Only these well-known codes are classified; anything else falls
 * through to the generic 500 path so raw database messages never leak.
 */
const PRISMA_KNOWN_CODES = new Set([
  'P1001', // Cannot reach database server
  'P1002', // Database server timeout
  'P2002', // Unique constraint violation
  'P2003', // Foreign key constraint violation
  'P2021', // Table does not exist
  'P2022', // Column does not exist
  'P2025', // Record not found
]);

// Helper to get user-friendly message for Prisma errors
function getPrismaErrorMessage(errorCode: string): string {
  switch (errorCode) {
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

/**
 * A raw error that carries a Prisma client error code.
 */
interface PrismaCodeError extends Error {
  code: string;
}

function isPrismaCodeError(err: Error): err is PrismaCodeError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof err.code === 'string'
  );
}

/**
 * Determine whether the error is a known Prisma client request error.
 *
 * Classification is code-based and allowlisted. An error whose `code`
 * property is a string is NOT assumed to be Prisma just because of that
 * property (the old check misclassified AppError/DomainError instances,
 * which also carry string `code` fields); the code must be one of the
 * known P#### codes above.
 */
function isPrismaKnownError(err: Error): err is PrismaCodeError {
  if (!isPrismaCodeError(err)) {
    return false;
  }
  const { code } = err;
  return (
    code.length === 5 &&
    code.startsWith('P') &&
    PRISMA_KNOWN_CODES.has(code)
  );
}

function getErrorMessage(err: Error): string {
  return typeof err.message === 'string' ? err.message : '';
}

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Express 4 may pass non-Error values; normalize before classification.
  if (typeof err !== 'object' || err === null || !('message' in err)) {
    console.error('Server Error (non-Error thrown):', err);
    return res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
      },
    });
  }

  // Handle Prisma known request errors (constraint violations, not found, etc.)
  if (isPrismaKnownError(err)) {
    console.error(
      '[ErrorHandler] Prisma Error:',
      err.code,
      getErrorMessage(err)
    );
    // eslint-disable-next-line @sync-erp/no-hardcoded-enum -- Prisma error code, not database enum
    const statusCode = err.code === 'P2025' ? 404 : 400;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: ERROR_CODES.DATABASE_ERROR,
        message: getPrismaErrorMessage(err.code),
      },
    });
  }

  // Handle Prisma validation errors (check for validation error message)
  if (
    getErrorMessage(err).includes(
      'The provided value for the column is too long'
    )
  ) {
    console.error('Prisma Validation Error:', getErrorMessage(err));
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
    getErrorMessage(err).includes('Can\'t reach database server') ||
    getErrorMessage(err).includes('Database connection')
  ) {
    console.error('Prisma Initialization Error:', getErrorMessage(err));
    return res.status(503).json({
      success: false,
      error: {
        code: ERROR_CODES.DATABASE_ERROR,
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

  // Handle domain errors (business rule violations)
  if (err instanceof DomainError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
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

  // For unexpected errors, never leak raw error internals (stack traces,
  // SQL fragments, dependency messages) to the response. Only the generic
  // message is sent; the full error stays in server logs.
  const responseMessage = isAppError
    ? err.message || 'An unexpected error occurred'
    : 'An unexpected error occurred';

  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: responseMessage,
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
