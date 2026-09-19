import { describe, expect, it, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { integrationV1HttpRouter } from '../../../src/routes/integration-v1.router';
import { apiKeyService } from '../../../src/services/api-key.service';
import { RentalAdminTaskService } from '../../../src/modules/rental/rental-admin-task.service';
import { rentalRouter } from '../../../src/trpc/routers/rental.router';
import type { Context } from '../../../src/trpc/context';
import type { RentalAdminTaskQueueResponse } from '@sync-erp/shared';

describe('Rental Admin Task Routes', () => {
  const COMPANY_ID = 'test-company-123';
  const VALID_KEY = 'valid-rental-api-key';

  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(integrationV1HttpRouter);
  });

  describe('REST GET /rental/tasks', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/rental/tasks');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when API key is invalid', async () => {
      vi.spyOn(apiKeyService, 'validateKey').mockResolvedValue(null);

      const res = await request(app)
        .get('/rental/tasks')
        .set('Authorization', 'Bearer invalid-key');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 when API key lacks rental:read permission', async () => {
      vi.spyOn(apiKeyService, 'validateKey').mockResolvedValue({
        companyId: COMPANY_ID,
        permissions: ['sales:read'],
        keyId: 'key-1',
        rateLimit: 100,
      });

      const res = await request(app)
        .get('/rental/tasks')
        .set('Authorization', `Bearer ${VALID_KEY}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 200 with task queue when authorized with rental:read', async () => {
      vi.spyOn(apiKeyService, 'validateKey').mockResolvedValue({
        companyId: COMPANY_ID,
        permissions: ['rental:read'],
        keyId: 'key-1',
        rateLimit: 100,
      });

      const mockResponse: RentalAdminTaskQueueResponse = {
        summary: {
          totalPendingTasks: 1,
          overdueCount: 0,
          todayCount: 1,
          upcomingCount: 0,
          byCategory: {
            confirmationCount: 1,
            deliveryCount: 0,
            pelunasanCount: 0,
            pickupCount: 0,
            returnSettlementCount: 0,
          },
        },
        tasks: [
          {
            id: 'task-order-1-confirm',
            orderId: '00000000-0000-0000-0000-000000000001',
            orderNumber: 'RO-1001',
            partnerId: '00000000-0000-0000-0000-000000000002',
            customerName: 'Budi Santoso',
            customerPhone: '081234567890',
            taskType: 'CONFIRM_AND_DP',
            category: 'CONFIRMATION',
            urgency: 'TODAY',
            title: 'Konfirmasi Pesanan & Catat DP: Budi Santoso',
            description: 'Pesanan DRAFT',
            scheduledDate: '2026-09-19T00:00:00.000Z',
            daysDiff: 0,
            orderStatus: 'DRAFT',
            paymentStatus: 'PENDING',
            totalAmount: 150000,
            depositAmount: 0,
            remainingAmount: 150000,
            deliveryAddress: 'Jl. Kaliurang',
            itemsSummary: '1x Kasur',
            suggestedAction: 'CONFIRM',
          },
        ],
      };

      const getQueueSpy = vi
        .spyOn(RentalAdminTaskService.prototype, 'getAdminTaskQueue')
        .mockResolvedValue(mockResponse);

      const res = await request(app)
        .get('/rental/tasks')
        .query({ category: 'CONFIRMATION', urgency: 'TODAY' })
        .set('Authorization', `Bearer ${VALID_KEY}`);

      expect(res.status).toBe(200);
      expect(res.body.summary.totalPendingTasks).toBe(1);
      expect(res.body.tasks.length).toBe(1);
      expect(res.body.tasks[0]?.orderNumber).toBe('RO-1001');
      expect(getQueueSpy).toHaveBeenCalledWith(COMPANY_ID, {
        category: 'CONFIRMATION',
        urgency: 'TODAY',
      });
    });

    it('handles empty string query parameters gracefully without validation error', async () => {
      vi.spyOn(apiKeyService, 'validateKey').mockResolvedValue({
        companyId: COMPANY_ID,
        permissions: ['rental:read'],
        keyId: 'key-1',
        rateLimit: 100,
      });

      const getQueueSpy = vi
        .spyOn(RentalAdminTaskService.prototype, 'getAdminTaskQueue')
        .mockResolvedValue({
          summary: {
            totalPendingTasks: 0,
            overdueCount: 0,
            todayCount: 0,
            upcomingCount: 0,
            byCategory: {
              confirmationCount: 0,
              deliveryCount: 0,
              pelunasanCount: 0,
              pickupCount: 0,
              returnSettlementCount: 0,
            },
          },
          tasks: [],
        });

      const res = await request(app)
        .get('/rental/tasks')
        .query({ referenceDate: '', category: '', urgency: '' })
        .set('Authorization', `Bearer ${VALID_KEY}`);

      expect(res.status).toBe(200);
      expect(getQueueSpy).toHaveBeenCalledWith(COMPANY_ID, {
        referenceDate: undefined,
        category: undefined,
        urgency: undefined,
      });
    });
  });

  describe('tRPC rental.tasks', () => {
    const mockContext: Context = {
      userId: 'user-001',
      companyId: COMPANY_ID,
      correlationId: 'corr-001',
      userPermissions: ['rental:read', 'rental:write'],
      userRole: 'ADMIN',
      businessShape: undefined,
      idempotencyKey: undefined,
      integrationId: undefined,
      isApiKeyAuth: false,
      permissions: undefined,
      apiKeyId: undefined,
      req: {} as Context['req'],
      res: {} as Context['res'],
    };

    const caller = rentalRouter.createCaller(mockContext);

    it('queries task queue via tasks.getQueue', async () => {
      const mockResponse: RentalAdminTaskQueueResponse = {
        summary: {
          totalPendingTasks: 2,
          overdueCount: 1,
          todayCount: 1,
          upcomingCount: 0,
          byCategory: {
            confirmationCount: 1,
            deliveryCount: 1,
            pelunasanCount: 0,
            pickupCount: 0,
            returnSettlementCount: 0,
          },
        },
        tasks: [],
      };

      vi.spyOn(
        RentalAdminTaskService.prototype,
        'getAdminTaskQueue'
      ).mockResolvedValue(mockResponse);

      const result = await caller.tasks.getQueue({
        category: 'ALL',
        urgency: 'ALL',
      });

      expect(result.summary.totalPendingTasks).toBe(2);
      expect(result.summary.overdueCount).toBe(1);
    });

    it('queries summary via tasks.getSummary', async () => {
      const mockResponse: RentalAdminTaskQueueResponse = {
        summary: {
          totalPendingTasks: 5,
          overdueCount: 2,
          todayCount: 2,
          upcomingCount: 1,
          byCategory: {
            confirmationCount: 2,
            deliveryCount: 1,
            pelunasanCount: 1,
            pickupCount: 1,
            returnSettlementCount: 0,
          },
        },
        tasks: [],
      };

      vi.spyOn(
        RentalAdminTaskService.prototype,
        'getAdminTaskQueue'
      ).mockResolvedValue(mockResponse);

      const summary = await caller.tasks.getSummary();

      expect(summary.totalPendingTasks).toBe(5);
      expect(summary.overdueCount).toBe(2);
      expect(summary.byCategory.confirmationCount).toBe(2);
    });
  });
});
