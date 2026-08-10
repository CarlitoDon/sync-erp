import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { DomainError, ERROR_CODES } from '@sync-erp/shared';
import {
  AppError,
  errorHandler,
} from '../../src/middlewares/errorHandler';

/**
 * Raw HTTP error classification tests.
 *
 * Verifies that the error handler:
 *  - classifies Prisma errors only by allowlisted P#### codes (never by a
 *    generic string `code` property, which would misclassify AppError /
 *    DomainError instances);
 *  - maps DomainError to its own status/code without Prisma interference;
 *  - never leaks raw error internals (stack traces, SQL fragments, dependency
 *    messages) in 5xx responses.
 */

function createMocks() {
  const res = {
    status: vi.fn(function (this: unknown) {
      return this;
    }),
    json: vi.fn(function (this: unknown) {
      return this;
    }),
  } as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  const req = {} as Request;
  const next: NextFunction = vi.fn();
  return { res, req, next };
}

interface JsonErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

function extractJson(res: {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}): JsonErrorBody | undefined {
  return res.json.mock.calls[0]?.[0] as JsonErrorBody | undefined;
}

describe('errorHandler raw error classification', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Prisma classification is allowlisted', () => {
    it('maps known P2002 constraint violation to 400 DATABASE_ERROR', () => {
      const { res, req, next } = createMocks();
      const err = Object.assign(new Error('raw unique constraint'), {
        code: 'P2002',
      });

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(extractJson(res)?.error).toEqual({
        code: 'DATABASE_ERROR',
        message: 'A record with this value already exists',
      });
    });

    it('maps P2025 record-not-found to 404', () => {
      const { res, req, next } = createMocks();
      const err = Object.assign(new Error('raw not found'), {
        code: 'P2025',
      });

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('does not treat a non-Prisma string code as a Prisma error', () => {
      // DomainError carries a string `code` property. The old handler
      // classified any string code as Prisma; it must now fall through to
      // the DomainError branch instead.
      const { res, req, next } = createMocks();
      const err = new DomainError(
        'Payment amount does not match order total',
        400,
        'INVALID_INPUT'
      );

      errorHandler(err, req, res, next);

      expect(extractJson(res)?.error).toEqual({
        code: 'INVALID_INPUT',
        message: 'Payment amount does not match order total',
      });
    });

    it('treats an unknown Prisma P-code as a generic 500, not a leak', () => {
      const { res, req, next } = createMocks();
      const err = Object.assign(new Error('P9999 secret detail'), {
        code: 'P9999',
      });

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(extractJson(res)?.error).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    });

    it('treats a random string code without P prefix as 500', () => {
      const { res, req, next } = createMocks();
      const err = Object.assign(new Error('weird'), { code: 'FOO' });

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(extractJson(res)?.error?.message).toBe(
        'An unexpected error occurred'
      );
    });
  });

  describe('DomainError handling', () => {
    it('returns domain status and code', () => {
      const { res, req, next } = createMocks();
      const err = new DomainError(
        'Order not found',
        404,
        'NOT_FOUND'
      );

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(extractJson(res)?.error).toEqual({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    });
  });

  describe('Zod validation errors', () => {
    it('returns 400 VALIDATION_ERROR with path details', () => {
      const { res, req, next } = createMocks();
      const schema = z.object({
        phone: z.string().min(8),
      });
      const err = new ZodError(
        schema.safeParse({ phone: 'x' }).error?.issues ?? []
      );

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(extractJson(res)?.error?.code).toBe('VALIDATION_ERROR');
      expect(extractJson(res)?.error?.details).toEqual([
        { path: 'phone', message: expect.any(String) },
      ]);
    });
  });

  describe('AppError passthrough', () => {
    it('returns AppError status, code, message, and details', () => {
      const { res, req, next } = createMocks();
      const err = new AppError(
        'Custom business message',
        409,
        ERROR_CODES.CONFLICT,
        { reason: 'duplicate' }
      );

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(extractJson(res)?.error).toEqual({
        code: 'CONFLICT',
        message: 'Custom business message',
        details: { reason: 'duplicate' },
      });
    });
  });

  describe('internal leakage prevention', () => {
    it('never returns raw stack trace or dependency message for 5xx', () => {
      const { res, req, next } = createMocks();
      const raw = new Error(
        'connect ECONNREFUSED 127.0.0.1:6379 at TCPConnectWrap.onselect\n' +
          '    at /app/node_modules/ioredis/lib/Redis.js:123'
      );

      errorHandler(raw, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(extractJson(res)?.error?.message).toBe(
        'An unexpected error occurred'
      );
    });

    it('keeps full error in server logs for debugging', () => {
      const { res, req, next } = createMocks();
      const raw = new Error('secret SQL detail');
      const logSpy = vi.spyOn(console, 'error');

      errorHandler(raw, req, res, next);

      expect(logSpy).toHaveBeenCalledWith('Server Error:', raw);
    });

    it('handles a thrown non-Error value without crashing', () => {
      const { res, req, next } = createMocks();
      const thrown = 'a thrown string';

      errorHandler(thrown as unknown as Error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(extractJson(res)?.error?.message).toBe(
        'An unexpected error occurred'
      );
    });
  });

  describe('database availability classification', () => {
    it('maps connection failure messages to 503 DATABASE_ERROR', () => {
      const { res, req, next } = createMocks();
      const err = new Error("Can't reach database server at host");

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(extractJson(res)?.error).toEqual({
        code: 'DATABASE_ERROR',
        message: 'Database service unavailable',
      });
    });
  });
});
