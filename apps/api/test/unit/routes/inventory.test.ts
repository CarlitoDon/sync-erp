import { vi, describe, it, expect, beforeEach } from 'vitest';
import express, { Response, NextFunction } from 'express';
import request from 'supertest';

// Mock auth middleware
vi.mock('../../../src/middlewares/auth', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  optionalAuthMiddleware: (_req: any, _res: any, next: any) => next(),
}));

// Mock InventoryService
vi.mock('@modules/inventory/inventory.service', () => ({
  InventoryService: function () {
    return {
      getStockLevels: vi
        .fn()
        .mockResolvedValue([{ productId: 'prod-1', quantity: 100 }]),
      getMovements: vi
        .fn()
        .mockResolvedValue([{ id: 'mov-1', type: 'IN' }]),
      processGoodsReceipt: vi
        .fn()
        .mockResolvedValue([{ id: 'mov-2' }]),
      adjustStock: vi
        .fn()
        .mockResolvedValue({ id: 'mov-3', type: 'ADJUSTMENT' }),
      // GRN methods (034-grn-fullstack)
      listGRN: vi.fn().mockResolvedValue([]),
      getGRN: vi
        .fn()
        .mockResolvedValue({ id: 'grn-1', status: 'DRAFT' }),
      createGRN: vi
        .fn()
        .mockResolvedValue({ id: 'grn-1', status: 'DRAFT' }),
      postGRN: vi
        .fn()
        .mockResolvedValue({ id: 'grn-1', status: 'POSTED' }),
    };
  },
}));

// Mock ProcurementService
vi.mock('@modules/procurement/procurement.service', () => ({
  ProcurementService: function () {
    return {
      receive: vi.fn().mockResolvedValue({
        movements: [{ id: 'mov-2' }],
        sagaLogId: 'saga-1',
      }),
    };
  },
}));

// Import after mocking
import { inventoryRouter } from '../../../src/routes/inventory';
import { errorHandler } from '../../../src/middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: Response, next: NextFunction) => {
    req.context = {
      userId: 'test-user',
      companyId: 'test-company',
    };
    req.company = {
      businessShape: 'RETAIL',
      configs: [],
    };
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
      const response = await request(app).get(
        '/api/inventory/movements'
      );
      expect(response.status).toBe(200);
    });

    it('should filter by productId', async () => {
      const response = await request(app).get(
        '/api/inventory/movements?productId=prod-1'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/inventory/receipts (GRN)', () => {
    it('should create goods receipt', async () => {
      const response = await request(app)
        .post('/api/inventory/receipts')
        .send({
          purchaseOrderId: '123e4567-e89b-12d3-a456-426614174000',
          items: [{ productId: 'prod-1', quantity: 10 }],
        });
      expect(response.status).toBe(201);
    });

    it('should accept optional notes', async () => {
      const response = await request(app)
        .post('/api/inventory/receipts')
        .send({
          purchaseOrderId: '123e4567-e89b-12d3-a456-426614174000',
          items: [{ productId: 'prod-1', quantity: 10 }],
          notes: 'GR-001',
        });
      expect(response.status).toBe(201);
    });
  });

  describe('POST /api/inventory/adjust', () => {
    it('should process stock adjustment', async () => {
      const response = await request(app)
        .post('/api/inventory/adjust')
        .send({
          productId: '123e4567-e89b-12d3-a456-426614174000',
          quantity: 10,
          costPerUnit: 50,
        });
      expect(response.status).toBe(201);
    });

    it('should accept optional reference', async () => {
      const response = await request(app)
        .post('/api/inventory/adjust')
        .send({
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
