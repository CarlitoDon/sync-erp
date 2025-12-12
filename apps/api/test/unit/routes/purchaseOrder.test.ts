import { vi, describe, it, expect, beforeEach } from 'vitest';
const express = require('express');
const request = require('supertest');

import {
  mockProcurementService,
  resetServiceMocks,
} from '../mocks/services.mock';

// Mock dependencies
vi.mock(
  '../../../src/modules/procurement/procurement.service',
  () => ({
    ProcurementService: vi
      .fn()
      .mockReturnValue(mockProcurementService),
  })
);

// Import after mocking
import { purchaseOrderRouter } from '../../../src/routes/purchaseOrder';
import { errorHandler } from '../../../src/middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.context = { userId: 'test-user', companyId: 'test-company' };
    next();
  });
  app.use('/api/purchase-orders', purchaseOrderRouter);
  app.use(errorHandler);
  return app;
};

describe('Purchase Order Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    resetServiceMocks();
    app = createTestApp();

    mockProcurementService.list.mockResolvedValue([
      { id: 'order-1', orderNumber: 'PO-001' },
    ]);
    mockProcurementService.getById.mockImplementation(
      (id: string) => {
        if (id === 'not-found') return Promise.resolve(null);
        return Promise.resolve({
          id: 'order-1',
          orderNumber: 'PO-001',
        });
      }
    );
    mockProcurementService.create.mockResolvedValue({
      id: 'order-new',
      orderNumber: 'PO-002',
    });
    mockProcurementService.confirm.mockResolvedValue({
      id: 'order-1',
      status: 'CONFIRMED',
    });
    mockProcurementService.cancel.mockResolvedValue({
      id: 'order-1',
      status: 'CANCELLED',
    });
  });

  describe('GET /api/purchase-orders', () => {
    it('should list purchase orders', async () => {
      const response = await request(app).get('/api/purchase-orders');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app).get(
        '/api/purchase-orders?status=DRAFT'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/purchase-orders/:id', () => {
    it('should get order by ID', async () => {
      const response = await request(app).get(
        '/api/purchase-orders/order-1'
      );
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app).get(
        '/api/purchase-orders/not-found'
      );
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/purchase-orders', () => {
    it('should create a purchase order', async () => {
      const response = await request(app)
        .post('/api/purchase-orders')
        .send({
          partnerId: '123e4567-e89b-12d3-a456-426614174000',
          items: [
            {
              productId: '123e4567-e89b-12d3-a456-426614174001',
              quantity: 10,
              price: 50,
            },
          ],
        });
      expect(response.status).toBe(201);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/purchase-orders')
        .send({ partnerId: 'invalid' });
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/purchase-orders/:id/confirm', () => {
    it('should confirm order', async () => {
      const response = await request(app).post(
        '/api/purchase-orders/order-1/confirm'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/purchase-orders/:id/cancel', () => {
    it('should cancel order', async () => {
      const response = await request(app).post(
        '/api/purchase-orders/order-1/cancel'
      );
      expect(response.status).toBe(200);
    });
  });
});
