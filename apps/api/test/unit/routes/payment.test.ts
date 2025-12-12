import { vi } from 'vitest';
const express = require('express');
import request from 'supertest';

// Mock PaymentService
vi.mock(
  '../../../src/modules/accounting/services/payment.service',
  () => ({
    PaymentService: vi.fn().mockImplementation(() => ({
      list: vi.fn().mockResolvedValue([{ id: 'pay-1', amount: 500 }]),
      getById: vi.fn().mockImplementation((id: string) => {
        if (id === 'not-found') return Promise.resolve(null);
        return Promise.resolve({ id: 'pay-1', amount: 500 });
      }),
      create: vi
        .fn()
        .mockResolvedValue({ id: 'pay-new', amount: 100 }),
      getPaymentHistory: vi.fn().mockResolvedValue([]),
    })),
  })
);

// Import after mocking
import { paymentRouter } from '../../../src/routes/payment';
import { errorHandler } from '../../../src/middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.context = { userId: 'test-user', companyId: 'test-company' };
    next();
  });
  app.use('/api/payments', paymentRouter);
  app.use(errorHandler);
  return app;
};

describe('Payment Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /api/payments', () => {
    it('should list payments', async () => {
      const response = await request(app).get('/api/payments');
      expect(response.status).toBe(200);
    });

    it('should filter by invoiceId', async () => {
      const response = await request(app).get(
        '/api/payments?invoiceId=inv-1'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/payments/:id', () => {
    it('should get payment by ID', async () => {
      const response = await request(app).get('/api/payments/pay-1');
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent payment', async () => {
      const response = await request(app).get(
        '/api/payments/not-found'
      );
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/payments', () => {
    it('should create a payment', async () => {
      const response = await request(app).post('/api/payments').send({
        invoiceId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100,
        method: 'BANK_TRANSFER',
      });
      expect(response.status).toBe(201);
    });

    it('should return 400 for invalid method', async () => {
      const response = await request(app).post('/api/payments').send({
        invoiceId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100,
        method: 'INVALID',
      });
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/payments/invoice/:invoiceId', () => {
    it('should get payment history for invoice', async () => {
      const response = await request(app).get(
        '/api/payments/invoice/inv-1'
      );
      expect(response.status).toBe(200);
    });
  });
});
