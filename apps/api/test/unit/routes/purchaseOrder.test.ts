import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

import {
  mockPurchaseOrderService,
  resetServiceMocks,
} from '../mocks/services.mock';

// Mock dependencies
vi.mock('@modules/procurement/purchase-order.service', () => ({
  PurchaseOrderService: function () {
    return mockPurchaseOrderService;
  },
}));

// Import after mocking
import { purchaseOrderRouter } from '@routes/purchaseOrder';
import { errorHandler } from '@middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  // Mock middleware implementations
  // The original middleware setting req.context is replaced by this mock setup.
  // Assuming `mockAuthMiddleware` is defined elsewhere and intended to be used here.
  // This snippet is syntactically corrected based on the user's intent to set req.context
  // within a mocked middleware, replacing the previous anonymous middleware.
  // Note: `mockAuthMiddleware` is not defined in the provided context,
  // so this assumes it would be imported or defined similarly to `mockPurchaseOrderService`.
  // For the purpose of making the provided change syntactically correct,
  // we'll integrate the context setting logic into the existing middleware structure.
  app.use((req: any, _res: any, next: any) => {
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

    mockPurchaseOrderService.list.mockResolvedValue([
      { id: 'order-1', orderNumber: 'PO-001' },
    ]);
    mockPurchaseOrderService.getById.mockImplementation(
      (id: string) => {
        if (id === 'not-found') return Promise.resolve(null);
        return Promise.resolve({
          id: 'order-1',
          orderNumber: 'PO-001',
        });
      }
    );
    mockPurchaseOrderService.create.mockResolvedValue({
      id: 'order-new',
      orderNumber: 'PO-002',
    });
    mockPurchaseOrderService.confirm.mockResolvedValue({
      id: 'order-1',
      status: 'CONFIRMED',
    });
    mockPurchaseOrderService.cancel.mockResolvedValue({
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
