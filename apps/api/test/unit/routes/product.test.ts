import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Use vi.hoisted to ensure mocks are available during hoisting
const { mockProductService, mockAuthMiddleware, mockRbacMiddleware } =
  vi.hoisted(() => {
    return {
      mockProductService: {
        create: vi.fn(),
        update: vi.fn(),
        getById: vi.fn(),
        list: vi.fn(),
        updateStock: vi.fn(),
        delete: vi.fn(),
      },
      mockAuthMiddleware: vi.fn(),
      mockRbacMiddleware: vi.fn(),
    };
  });

vi.mock('@modules/product/product.service', () => ({
  ProductService: function () {
    return mockProductService;
  },
}));

vi.mock('@middlewares/auth', () => ({
  authMiddleware: mockAuthMiddleware,
}));

vi.mock('@middlewares/rbac', () => ({
  checkPermissions: () => mockRbacMiddleware,
}));

// Import after mocking
import { productRouter } from '@routes/product';
import { errorHandler } from '@middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.context = { userId: 'test-user', companyId: 'test-company' };
    next();
  });
  app.use('/api/products', productRouter);
  app.use(errorHandler);
  return app;
};

describe('Product Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();

    // Configure default mock return values
    mockProductService.list.mockResolvedValue([
      {
        id: 'prod-1',
        sku: 'SKU1',
        name: 'Product 1',
        price: 100,
        stockQty: 10,
      },
      {
        id: 'prod-2',
        sku: 'SKU2',
        name: 'Product 2',
        price: 200,
        stockQty: 5,
      },
    ]);
    mockProductService.getById.mockResolvedValue({
      id: 'prod-1',
      sku: 'SKU1',
      name: 'Product 1',
      price: 100,
      stockQty: 10,
      averageCost: 80,
    });
    mockProductService.create.mockResolvedValue({
      id: 'prod-new',
      sku: 'NEW',
      name: 'New Product',
    });
    mockProductService.update.mockResolvedValue({
      id: 'prod-1',
      name: 'Updated Product',
    });
    mockProductService.delete.mockResolvedValue(undefined);

    app = createTestApp();
  });

  describe('GET /api/products', () => {
    it('should list all products', async () => {
      (mockAuthMiddleware as any).mockImplementation(
        (_req: any, _res: any, next: any) => next()
      );
      (mockRbacMiddleware as any).mockImplementation(
        (_req: any, _res: any, next: any) => next()
      );
      mockProductService.list.mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU1',
          name: 'Product 1',
          price: 100,
          stockQty: 10,
        },
        {
          id: 'prod-2',
          sku: 'SKU2',
          name: 'Product 2',
          price: 200,
          stockQty: 5,
        },
      ]);
      const response = await request(app).get('/api/products');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should get product by ID', async () => {
      const response = await request(app).get('/api/products/prod-1');
      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('prod-1');
    });
  });

  describe('POST /api/products', () => {
    it('should create a product', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({ sku: 'NEW', name: 'New Product', price: 99.99 });
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({ sku: '', name: 'A' });
      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/products/:id', () => {
    it('should update a product', async () => {
      const response = await request(app)
        .put('/api/products/prod-1')
        .send({ name: 'Updated Name' });
      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should delete a product', async () => {
      const response = await request(app).delete(
        '/api/products/prod-1'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/products/:id/stock', () => {
    it('should get stock level', async () => {
      const response = await request(app).get(
        '/api/products/prod-1/stock'
      );
      expect(response.status).toBe(200);
      expect(response.body.data.stockQty).toBe(10);
    });
  });
});
