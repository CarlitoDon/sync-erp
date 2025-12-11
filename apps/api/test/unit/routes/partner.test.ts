import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Use vi.hoisted to create mocks that are available before vi.mock is hoisted
const {
  mockList,
  mockListSuppliers,
  mockListCustomers,
  mockGetById,
  mockCreate,
  mockUpdate,
  mockDelete,
} = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockListSuppliers: vi.fn(),
  mockListCustomers: vi.fn(),
  mockGetById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../../src/services/PartnerService', () => ({
  PartnerService: vi.fn().mockImplementation(() => ({
    list: mockList,
    listSuppliers: mockListSuppliers,
    listCustomers: mockListCustomers,
    getById: mockGetById,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
  })),
}));

// Mock database PartnerType enum
vi.mock('@sync-erp/database', () => ({
  PartnerType: {
    SUPPLIER: 'SUPPLIER',
    CUSTOMER: 'CUSTOMER',
  },
}));

// Import AFTER mocking
import { partnerRouter } from '../../../src/routes/partner';
import { errorHandler } from '../../../src/middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.context = { userId: 'test-user', companyId: 'test-company' };
    next();
  });
  app.use('/api/partners', partnerRouter);
  app.use(errorHandler);
  return app;
};

describe('Partner Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock implementations
    mockList.mockResolvedValue([
      { id: 'partner-1', name: 'Supplier 1', type: 'SUPPLIER' },
      { id: 'partner-2', name: 'Customer 1', type: 'CUSTOMER' },
    ]);
    mockListSuppliers.mockResolvedValue([{ id: 'partner-1', name: 'Supplier 1' }]);
    mockListCustomers.mockResolvedValue([{ id: 'partner-2', name: 'Customer 1' }]);
    mockGetById.mockResolvedValue({ id: 'partner-1', name: 'Test Partner' });
    mockCreate.mockResolvedValue({ id: 'partner-new', name: 'New Partner' });
    mockUpdate.mockResolvedValue({ id: 'partner-1', name: 'Updated Partner' });
    mockDelete.mockResolvedValue(undefined);
    app = createTestApp();
  });

  describe('GET /api/partners', () => {
    it('should list all partners', async () => {
      const response = await request(app).get('/api/partners');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter by type SUPPLIER', async () => {
      const response = await request(app).get('/api/partners?type=SUPPLIER');
      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith('test-company', 'SUPPLIER');
    });

    it('should filter by type CUSTOMER', async () => {
      const response = await request(app).get('/api/partners?type=CUSTOMER');
      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith('test-company', 'CUSTOMER');
    });
  });

  describe('GET /api/partners/suppliers', () => {
    it('should list suppliers only', async () => {
      const response = await request(app).get('/api/partners/suppliers');
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/partners/customers', () => {
    it('should list customers only', async () => {
      const response = await request(app).get('/api/partners/customers');
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/partners/:id', () => {
    it('should get partner by ID', async () => {
      const response = await request(app).get('/api/partners/partner-1');
      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('partner-1');
    });

    it('should return 404 for non-existent partner', async () => {
      mockGetById.mockResolvedValue(null);
      const response = await request(app).get('/api/partners/nonexistent');
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/partners', () => {
    it('should create a SUPPLIER partner', async () => {
      const response = await request(app)
        .post('/api/partners')
        .send({ name: 'New Supplier', type: 'SUPPLIER' });
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        'test-company',
        expect.objectContaining({ name: 'New Supplier', type: 'SUPPLIER' })
      );
    });

    it('should create a CUSTOMER partner', async () => {
      const response = await request(app)
        .post('/api/partners')
        .send({ name: 'New Customer', type: 'CUSTOMER' });
      expect(response.status).toBe(201);
      expect(mockCreate).toHaveBeenCalledWith(
        'test-company',
        expect.objectContaining({ name: 'New Customer', type: 'CUSTOMER' })
      );
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app).post('/api/partners').send({ name: 'A' });
      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/partners/:id', () => {
    it('should update a partner', async () => {
      const response = await request(app)
        .put('/api/partners/partner-1')
        .send({ name: 'Updated Name' });
      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/partners/:id', () => {
    it('should delete a partner', async () => {
      const response = await request(app).delete('/api/partners/partner-1');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
