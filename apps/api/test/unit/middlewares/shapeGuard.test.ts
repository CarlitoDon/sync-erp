import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { BusinessShape } from '@sync-erp/database';
import { requireActiveShape } from '../../../src/middlewares/shapeGuard';

describe('shapeGuard middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonSpy = vi.fn();
    statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });
    mockRes = {
      status: statusSpy as unknown as Response['status'],
    };
    mockNext = vi.fn();
  });

  describe('requireActiveShape', () => {
    it('should allow request when company shape is RETAIL', () => {
      mockReq = {
        company: {
          id: 'co-1',
          name: 'Test Company',
          businessShape: BusinessShape.RETAIL,
        },
      };

      requireActiveShape()(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should allow request when company shape is SERVICE', () => {
      mockReq = {
        company: {
          id: 'co-1',
          name: 'Test Company',
          businessShape: BusinessShape.SERVICE,
        },
      };

      requireActiveShape()(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should allow request when company shape is MANUFACTURING', () => {
      mockReq = {
        company: {
          id: 'co-1',
          name: 'Test Company',
          businessShape: BusinessShape.MANUFACTURING,
        },
      };

      requireActiveShape()(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should block request when company shape is PENDING', () => {
      mockReq = {
        company: {
          id: 'co-1',
          name: 'Test Company',
          businessShape: BusinessShape.PENDING,
        },
      };

      requireActiveShape()(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SHAPE_PENDING',
          message:
            'Operations blocked until business shape is selected. Please complete company setup.',
          action: 'COMPLETE_SETUP',
        },
      });
    });

    it('should call next when no company in context', () => {
      mockReq = {};

      requireActiveShape()(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should include actionable error message with setup guidance', () => {
      mockReq = {
        company: {
          id: 'co-1',
          name: 'Test Company',
          businessShape: BusinessShape.PENDING,
        },
      };

      requireActiveShape()(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining(
              'complete company setup'
            ),
            action: 'COMPLETE_SETUP',
          }),
        })
      );
    });
  });
});
