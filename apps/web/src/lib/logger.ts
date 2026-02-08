/**
 * Centralized logging utility for the frontend.
 * Provides consistent error handling and future extensibility
 * (e.g., Sentry integration, analytics).
 */

/* eslint-disable no-console */

interface LogContext {
  /** Unique identifier for tracking (e.g., orderId, userId) */
  id?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Logger singleton with consistent formatting.
 */
export const logger = {
  debug(message: string, context?: LogContext) {
    if (import.meta.env.DEV) {
      console.debug(`[DEBUG] ${message}`, context ?? '');
    }
  },

  info(message: string, context?: LogContext) {
    console.info(`[INFO] ${message}`, context ?? '');
  },

  warn(message: string, context?: LogContext) {
    console.warn(`[WARN] ${message}`, context ?? '');
  },

  error(message: string, error?: unknown, context?: LogContext) {
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error;

    console.error(`[ERROR] ${message}`, {
      error: errorDetails,
      ...context,
    });

    // TODO: Add Sentry/error tracking integration here
    // if (typeof Sentry !== 'undefined') {
    //   Sentry.captureException(error, { extra: context });
    // }
  },
};

/**
 * Helper to safely get error message from unknown error type.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}

/**
 * Wrapper for async operations with consistent error handling.
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: { action: string; silent?: boolean }
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    logger.error(`Failed to ${context.action}`, error);
    if (!context.silent) {
      // Could integrate with toast notifications here
    }
    return null;
  }
}
