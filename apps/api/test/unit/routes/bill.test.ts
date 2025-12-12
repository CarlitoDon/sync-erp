import { vi } from 'vitest';
const express = require('express');
import request from 'supertest';

// Mock BillService
vi.mock('../../../src/services/BillService', () => ({
  BillService: vi.fn().mockImplementation(() => ({
    list: vi
      .fn()
      .mockResolvedValue([{ id: 'bill-1', billNumber: 'BILL-001' }]),
    getById: vi.fn().mockImplementation((id: string) => {
      if (id === 'not-found') return Promise.resolve(null);
      return Promise.resolve({
        id: 'bill-1',
        billNumber: 'BILL-001',
      });
    }),
    getOutstanding: vi.fn().mockResolvedValue([]),
    createFromPurchaseOrder: vi
      .fn()
      .mockResolvedValue({ id: 'bill-new' }),
    post: vi
      .fn()
      .mockResolvedValue({ id: 'bill-1', status: 'POSTED' }),
    void: vi.fn().mockResolvedValue({ id: 'bill-1', status: 'VOID' }),
    getRemainingAmount: vi.fn().mockResolvedValue(300),
  })),
}));

// Import after mocking
import { billRouter } from '../../../src/routes/bill';
import { errorHandler } from '../../../src/middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.context = { userId: 'test-user', companyId: 'test-company' };
    next();
  });
  app.use('/api/bills', billRouter);
  app.use(errorHandler);
  return app;
};

describe('Bill Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /api/bills', () => {
    it('should list bills', async () => {
      const response = await request(app).get('/api/bills');
      expect(response.status).toBe(200);
    });

    it('should filter by status', async () => {
      const response = await request(app).get(
        '/api/bills?status=POSTED'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/bills/outstanding', () => {
    it('should list outstanding bills', async () => {
      const response = await request(app).get(
        '/api/bills/outstanding'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/bills/:id', () => {
    it('should get bill by ID', async () => {
      const response = await request(app).get('/api/bills/bill-1');
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent bill', async () => {
      const response = await request(app).get('/api/bills/not-found');
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/bills', () => {
    it('should create bill from purchase order', async () => {
      const response = await request(app)
        .post('/api/bills')
        .send({ orderId: '123e4567-e89b-12d3-a456-426614174000' });
      expect(response.status).toBe(201);
    });

    it('should accept optional fields', async () => {
      const response = await request(app).post('/api/bills').send({
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        invoiceNumber: 'SUP-INV-001',
        notes: 'Test notes',
      });
      expect(response.status).toBe(201);
    });
  });

  describe('POST /api/bills/:id/post', () => {
    it('should post bill', async () => {
      const response = await request(app).post(
        '/api/bills/bill-1/post'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/bills/:id/void', () => {
    it('should void bill', async () => {
      const response = await request(app).post(
        '/api/bills/bill-1/void'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/bills/:id/remaining', () => {
    it('should get remaining amount', async () => {
      const response = await request(app).get(
        '/api/bills/bill-1/remaining'
      );
      expect(response.status).toBe(200);
      expect(response.body.data.remaining).toBe(300);
    });
  });
});
