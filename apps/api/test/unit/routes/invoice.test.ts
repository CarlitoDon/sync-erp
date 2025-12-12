import { vi } from 'vitest';
const express = require('express');
import request from 'supertest';

// Mock InvoiceService
vi.mock(
  '../../../src/modules/accounting/services/invoice.service',
  () => ({
    InvoiceService: vi.fn().mockImplementation(() => ({
      list: vi
        .fn()
        .mockResolvedValue([
          { id: 'inv-1', invoiceNumber: 'INV-001' },
        ]),
      getById: vi.fn().mockImplementation((id: string) => {
        if (id === 'not-found') return Promise.resolve(null);
        return Promise.resolve({
          id: 'inv-1',
          invoiceNumber: 'INV-001',
        });
      }),
      getOutstanding: vi.fn().mockResolvedValue([]),
      createFromSalesOrder: vi
        .fn()
        .mockResolvedValue({
          id: 'inv-new',
          invoiceNumber: 'INV-002',
        }),
      post: vi
        .fn()
        .mockResolvedValue({ id: 'inv-1', status: 'POSTED' }),
      void: vi
        .fn()
        .mockResolvedValue({ id: 'inv-1', status: 'VOID' }),
      getRemainingAmount: vi.fn().mockResolvedValue(500),
    })),
  })
);

// Import after mocking
import { invoiceRouter } from '../../../src/routes/invoice';
import { errorHandler } from '../../../src/middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.context = { userId: 'test-user', companyId: 'test-company' };
    next();
  });
  app.use('/api/invoices', invoiceRouter);
  app.use(errorHandler);
  return app;
};

describe('Invoice Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /api/invoices', () => {
    it('should list invoices', async () => {
      const response = await request(app).get('/api/invoices');
      expect(response.status).toBe(200);
    });

    it('should filter by status', async () => {
      const response = await request(app).get(
        '/api/invoices?status=POSTED'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/invoices/outstanding', () => {
    it('should list outstanding invoices', async () => {
      const response = await request(app).get(
        '/api/invoices/outstanding'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('should get invoice by ID', async () => {
      const response = await request(app).get('/api/invoices/inv-1');
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent invoice', async () => {
      const response = await request(app).get(
        '/api/invoices/not-found'
      );
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/invoices', () => {
    it('should create invoice from sales order', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .send({ orderId: '123e4567-e89b-12d3-a456-426614174000' });
      expect(response.status).toBe(201);
    });

    it('should accept optional taxRate', async () => {
      const response = await request(app).post('/api/invoices').send({
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        taxRate: 0.11,
      });
      expect(response.status).toBe(201);
    });
  });

  describe('POST /api/invoices/:id/post', () => {
    it('should post invoice', async () => {
      const response = await request(app).post(
        '/api/invoices/inv-1/post'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/invoices/:id/void', () => {
    it('should void invoice', async () => {
      const response = await request(app).post(
        '/api/invoices/inv-1/void'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/invoices/:id/remaining', () => {
    it('should get remaining amount', async () => {
      const response = await request(app).get(
        '/api/invoices/inv-1/remaining'
      );
      expect(response.status).toBe(200);
      expect(response.body.data.remaining).toBe(500);
    });
  });
});
