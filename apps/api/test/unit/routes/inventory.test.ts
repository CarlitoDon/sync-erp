import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock InventoryService
vi.mock('../../../src/services/InventoryService', () => ({
  InventoryService: vi.fn().mockImplementation(() => ({
    getStockLevels: vi.fn().mockResolvedValue([{ productId: 'prod-1', quantity: 100 }]),
    getMovements: vi.fn().mockResolvedValue([{ id: 'mov-1', type: 'IN' }]),
    processGoodsReceipt: vi.fn().mockResolvedValue([{ id: 'mov-2' }]),
    adjustStock: vi.fn().mockResolvedValue({ id: 'mov-3', type: 'ADJUSTMENT' }),
  })),
}));

// Import after mocking
import { inventoryRouter } from '../../../src/routes/inventory';
import { errorHandler } from '../../../src/middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.context = { userId: 'test-user', companyId: 'test-company' };
    next();
  });
  app.use('/api/inventory', inventoryRouter);
  app.use(errorHandler);
  return app;
};

describe('Inventory Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /api/inventory/stock', () => {
    it('should list stock levels', async () => {
      const response = await request(app).get('/api/inventory/stock');
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/inventory/movements', () => {
    it('should list movements', async () => {
      const response = await request(app).get('/api/inventory/movements');
      expect(response.status).toBe(200);
    });

    it('should filter by productId', async () => {
      const response = await request(app).get('/api/inventory/movements?productId=prod-1');
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/inventory/goods-receipt', () => {
    it('should process goods receipt', async () => {
      const response = await request(app)
        .post('/api/inventory/goods-receipt')
        .send({ orderId: '123e4567-e89b-12d3-a456-426614174000' });
      expect(response.status).toBe(201);
    });

    it('should accept optional reference', async () => {
      const response = await request(app).post('/api/inventory/goods-receipt').send({
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        reference: 'GR-001',
      });
      expect(response.status).toBe(201);
    });
  });

  describe('POST /api/inventory/adjust', () => {
    it('should process stock adjustment', async () => {
      const response = await request(app).post('/api/inventory/adjust').send({
        productId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 10,
        costPerUnit: 50,
      });
      expect(response.status).toBe(201);
    });

    it('should accept optional reference', async () => {
      const response = await request(app).post('/api/inventory/adjust').send({
        productId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: -5,
        costPerUnit: 50,
        reference: 'ADJ-001',
      });
      expect(response.status).toBe(201);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/inventory/adjust')
        .send({ productId: 'invalid' });
      expect(response.status).toBe(400);
    });
  });
});
