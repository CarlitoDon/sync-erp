// ============================================
// Server-Side Constants
// ============================================

/**
 * Default timeout for Prisma transactions (ms).
 * Used across all services for `prisma.$transaction({ timeout })`.
 */
export const TRANSACTION_TIMEOUT_MS = 60_000;

/**
 * Webhook delivery timeout (ms).
 */
export const WEBHOOK_TIMEOUT_MS = 10_000;

/**
 * Webhook test ping timeout (ms).
 */
export const WEBHOOK_TEST_TIMEOUT_MS = 5_000;

/**
 * Bot status fetch timeout (ms).
 */
export const BOT_STATUS_TIMEOUT_MS = 3_000;

/**
 * Default API key rate limit (requests per window).
 */
export const DEFAULT_RATE_LIMIT = 1_000;

/**
 * API key prefix length for display (e.g., "sk_xxxxxxx").
 */
export const API_KEY_PREFIX_LENGTH = 11;

/**
 * Graceful shutdown timeout before force exit (ms).
 */
export const SHUTDOWN_TIMEOUT_MS = 5_000;
