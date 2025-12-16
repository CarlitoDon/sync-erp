import { vi, describe, beforeEach, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  mockSalesService,
  resetServiceMocks,
} from '../mocks/services.mock';

// Mock dependencies
vi.mock('../../../src/modules/sales/sales.service', () => ({
  SalesService: function () {
    return mockSalesService;
  },
}));

// FulfillmentService is now merged into SalesService (ship method)

// Import after mocking
import { salesOrderRouter } from '../../../src/routes/salesOrder';
import { errorHandler } from '../../../src/middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.context = { userId: 'test-user', companyId: 'test-company' };
    next();
  });
  app.use('/api/sales-orders', salesOrderRouter);
  app.use(errorHandler);
  return app;
};

describe('Sales Order Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    resetServiceMocks();

    // Setup default mock responses
    mockSalesService.list.mockResolvedValue([
      { id: 'order-1', orderNumber: 'SO-001', status: 'DRAFT' },
    ]);
    mockSalesService.getById.mockImplementation((id: string) => {
      if (id === 'not-found') return Promise.resolve(null);
      return Promise.resolve({
        id: 'order-1',
        orderNumber: 'SO-001',
      });
    });
    mockSalesService.create.mockResolvedValue({
      id: 'order-new',
      orderNumber: 'SO-002',
    });
    mockSalesService.confirm.mockResolvedValue({
      id: 'order-1',
      status: 'CONFIRMED',
    });
    mockSalesService.cancel.mockResolvedValue({
      id: 'order-1',
      status: 'CANCELLED',
    });
    mockSalesService.ship.mockResolvedValue([{ id: 'mov-1' }]);

    app = createTestApp();
  });

  describe('GET /api/sales-orders', () => {
    it('should list sales orders', async () => {
      const response = await request(app).get('/api/sales-orders');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app).get(
        '/api/sales-orders?status=DRAFT'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/sales-orders/:id', () => {
    it('should get order by ID', async () => {
      const response = await request(app).get(
        '/api/sales-orders/order-1'
      );
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app).get(
        '/api/sales-orders/not-found'
      );
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/sales-orders', () => {
    it('should create a sales order', async () => {
      const response = await request(app)
        .post('/api/sales-orders')
        .send({
          partnerId: '123e4567-e89b-12d3-a456-426614174000',
          items: [
            {
              productId: '123e4567-e89b-12d3-a456-426614174001',
              quantity: 5,
              price: 100,
            },
          ],
        });
      expect(response.status).toBe(201);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/sales-orders')
        .send({ partnerId: 'valid-but-missing-details' });
      // Note: original test sent 'invalid' for partnerId, but UUID check might be stricter.
      // Schema validation will fail if items are missing or structure bad.
      // We expect 400.
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/sales-orders/:id/confirm', () => {
    it('should confirm order', async () => {
      const response = await request(app).post(
        '/api/sales-orders/order-1/confirm'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/sales-orders/:id/cancel', () => {
    it('should cancel order', async () => {
      const response = await request(app).post(
        '/api/sales-orders/order-1/cancel'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/sales-orders/:id/ship', () => {
    it('should process shipment', async () => {
      const response = await request(app).post(
        '/api/sales-orders/order-1/ship'
      );
      expect(response.status).toBe(200);
    });

    it('should process shipment with reference', async () => {
      const response = await request(app)
        .post('/api/sales-orders/order-1/ship')
        .send({ reference: 'SHIP-001' });
      expect(response.status).toBe(200);
    });
  });
});
