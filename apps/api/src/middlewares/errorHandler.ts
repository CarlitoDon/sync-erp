import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ERROR_CODES } from '@sync-erp/shared';

// Custom error class for application errors
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = ERROR_CODES.INTERNAL_ERROR,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
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
  const errorCode = isAppError ? err.code : ERROR_CODES.INTERNAL_ERROR;
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
export const NotFoundError = (message: string = 'Resource not found') =>
  new AppError(message, 404, ERROR_CODES.NOT_FOUND);

export const ValidationError = (message: string, details?: unknown) =>
  new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, details);

export const UnauthorizedError = (message: string = 'Unauthorized') =>
  new AppError(message, 401, ERROR_CODES.UNAUTHORIZED);

export const ForbiddenError = (message: string = 'Forbidden') =>
  new AppError(message, 403, ERROR_CODES.FORBIDDEN);

export const ConflictError = (message: string) => new AppError(message, 409, ERROR_CODES.CONFLICT);
