import { vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import {
  errorHandler,
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '../../../src/middlewares/errorHandler';

// Mock request, response, and next
const mockRequest = {} as Request;
const mockNext = vi.fn() as NextFunction;

const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
};

describe('errorHandler middleware', () => {
  describe('AppError class', () => {
    it('should create an error with custom properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR', {
        field: 'test',
      });

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ field: 'test' });
    });

    it('should use defaults when not provided', () => {
      const error = new AppError('Test error');

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('errorHandler function', () => {
    it('should handle ZodError with validation details', () => {
      const res = createMockResponse();
      const schema = z.object({ name: z.string().min(1) });
      let zodError: ZodError | undefined;

      try {
        schema.parse({ name: '' });
      } catch (e) {
        zodError = e as ZodError;
      }

      errorHandler(zodError!, mockRequest, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ path: 'name' }),
          ]),
        },
      });
    });

    it('should handle AppError with custom status code', () => {
      const res = createMockResponse();
      const error = new AppError('Not found', 404, 'NOT_FOUND');

      errorHandler(error, mockRequest, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Not found',
          details: undefined,
        },
      });
    });

    it('should handle generic Error as 500', () => {
      const res = createMockResponse();
      const error = new Error('Something went wrong');

      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      errorHandler(error, mockRequest, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong',
          details: undefined,
        },
      });

      consoleSpy.mockRestore();
    });

    it('should log server errors (500+)', () => {
      const res = createMockResponse();
      const error = new AppError(
        'Server crash',
        503,
        'SERVICE_UNAVAILABLE'
      );
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      errorHandler(error, mockRequest, res, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith('Server Error:', error);
      consoleSpy.mockRestore();
    });
  });

  describe('Error factories', () => {
    it('NotFoundError should return 404', () => {
      const error = NotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('ValidationError should return 400', () => {
      const error = ValidationError('Invalid input', {
        field: 'email',
      });
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('UnauthorizedError should return 401', () => {
      const error = UnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('ForbiddenError should return 403', () => {
      const error = ForbiddenError();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('ConflictError should return 409', () => {
      const error = ConflictError('Email already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });
});
