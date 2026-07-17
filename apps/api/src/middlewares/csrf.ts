/**
 * CSRF protection middleware using the double-submit cookie pattern.
 *
 * How it works:
 *   1. On any request, if the csrf cookie doesn't exist, generate one.
 *   2. On mutating requests (POST/PUT/PATCH/DELETE), validate that the
 *      X-CSRF-Token header matches the csrf cookie value.
 *   3. GET/HEAD/OPTIONS are exempt (safe methods).
 *
 * This works with tRPC because all tRPC calls go through POST.
 * Cookie-based session auth is the primary CSRF attack vector;
 * Bearer-token API key auth is not vulnerable (tokens aren't auto-sent).
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE = 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

type RequestWithCsrfToken = Request & { csrfToken?: string };

/**
 * Generate a cryptographically secure CSRF token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Express middleware that:
 *  - Sets a CSRF cookie on every response (if missing).
 *  - Validates the X-CSRF-Token header on mutating requests.
 */
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Always ensure the cookie exists (set on first visit)
  let token = req.cookies[CSRF_COOKIE];
  if (!token) {
    token = generateCsrfToken();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // JS must be able to read it
      secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours (shorter than session)
    });
  }

  // Attach token to request for use in route handlers
  (req as RequestWithCsrfToken).csrfToken = token;

  // Skip validation for safe methods
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // For API key / Bearer token auth, CSRF is not a concern
  // (Authorization header isn't auto-attached by browsers)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  // Validate header matches cookie (double-submit pattern)
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;
  if (!headerToken || headerToken !== token) {
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'CSRF token missing or invalid. Include X-CSRF-Token header matching the csrf-token cookie.',
      },
    });
    return;
  }

  next();
}
