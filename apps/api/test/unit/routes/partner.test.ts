import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Use vi.hoisted to ensure mocks are available during hoisting
const { mockPartnerService, mockAuthMiddleware, mockRbacMiddleware } =
  vi.hoisted(() => {
    return {
      mockPartnerService: {
        create: vi.fn(),
        update: vi.fn(),
        getById: vi.fn(),
        list: vi.fn(),
        listSuppliers: vi.fn(),
        listCustomers: vi.fn(),
        delete: vi.fn(),
      },
      mockAuthMiddleware: vi.fn(),
      mockRbacMiddleware: vi.fn(),
    };
  });

// Mock dependencies
vi.mock('../../../src/modules/partner/partner.service', () => ({
  PartnerService: function () {
    return mockPartnerService;
  },
}));

vi.mock('../../../src/middlewares/auth', () => ({
  authMiddleware: mockAuthMiddleware,
}));

vi.mock('../../../src/middlewares/rbac', () => ({
  checkPermissions: () => mockRbacMiddleware,
}));

// Mock database PartnerType enum

// Import AFTER mocking
import { partnerRouter } from '../../../src/routes/partner';
import { errorHandler } from '../../../src/middlewares/errorHandler';

// Setup Express App
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Set req.context for tests (router doesn't have auth middleware)
  app.use((req: any, _res: any, next: any) => {
    req.context = {
      userId: 'test-user',
      companyId: 'test-company',
    };
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

    // Configure default mock return values
    mockPartnerService.list.mockResolvedValue([
      { id: 'partner-1', name: 'Supplier 1', type: 'SUPPLIER' },
      { id: 'partner-2', name: 'Customer 1', type: 'CUSTOMER' },
    ]);
    mockPartnerService.listSuppliers.mockResolvedValue([
      { id: 'partner-1', name: 'Supplier 1', type: 'SUPPLIER' },
    ]);
    mockPartnerService.listCustomers.mockResolvedValue([
      { id: 'partner-2', name: 'Customer 1', type: 'CUSTOMER' },
    ]);
    mockPartnerService.getById.mockResolvedValue({
      id: 'partner-1',
      name: 'Test Partner',
      type: 'SUPPLIER',
    });
    mockPartnerService.create.mockResolvedValue({
      id: 'partner-new',
      name: 'New Partner',
      type: 'SUPPLIER',
    });
    mockPartnerService.update.mockResolvedValue({
      id: 'partner-1',
      name: 'Updated Partner',
    });
    mockPartnerService.delete.mockResolvedValue(undefined);

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
      const response = await request(app).get(
        '/api/partners?type=SUPPLIER'
      );
      expect(response.status).toBe(200);
      expect(mockPartnerService.list).toHaveBeenCalledWith(
        'test-company',
        'SUPPLIER'
      );
    });

    it('should filter by type CUSTOMER', async () => {
      const response = await request(app).get(
        '/api/partners?type=CUSTOMER'
      );
      expect(response.status).toBe(200);
      expect(mockPartnerService.list).toHaveBeenCalledWith(
        'test-company',
        'CUSTOMER'
      );
    });
  });

  describe('GET /api/partners/suppliers', () => {
    it('should list suppliers only', async () => {
      const response = await request(app).get(
        '/api/partners/suppliers'
      );
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/partners/customers', () => {
    it('should list customers only', async () => {
      const response = await request(app).get(
        '/api/partners/customers'
      );
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/partners/:id', () => {
    it('should get partner by ID', async () => {
      const response = await request(app).get(
        '/api/partners/partner-1'
      );
      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('partner-1');
    });

    it('should return 404 for non-existent partner', async () => {
      mockPartnerService.getById.mockResolvedValue(null);
      const response = await request(app).get(
        '/api/partners/nonexistent'
      );
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
      expect(mockPartnerService.create).toHaveBeenCalledWith(
        'test-company',
        expect.objectContaining({
          name: 'New Supplier',
          type: 'SUPPLIER',
        })
      );
    });

    it('should create a CUSTOMER partner', async () => {
      const response = await request(app)
        .post('/api/partners')
        .send({ name: 'New Customer', type: 'CUSTOMER' });
      expect(response.status).toBe(201);
      expect(mockPartnerService.create).toHaveBeenCalledWith(
        'test-company',
        expect.objectContaining({
          name: 'New Customer',
          type: 'CUSTOMER',
        })
      );
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/partners')
        .send({ name: 'A' });
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
      const response = await request(app).delete(
        '/api/partners/partner-1'
      );
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
