import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock CompanyService
const mockCompanyService = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  listForUser: vi.fn(),
  join: vi.fn(),
}));

vi.mock('@modules/company/company.service', () => ({
  CompanyService: function () {
    return mockCompanyService;
  },
}));

vi.mock('../../../src/middlewares/auth', () => ({
  authMiddleware: vi.fn((_req, _res, next) => next()),
}));

vi.mock('../../../src/middlewares/rbac', () => ({
  checkPermissions: () => vi.fn((_req, _res, next) => next()),
}));

// Import after mocking
import { companyRouter } from '../../../src/routes/company';
import { errorHandler } from '../../../src/middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.context = { userId: 'test-user', companyId: 'test-company' };
    next();
  });
  app.use('/api/companies', companyRouter);
  app.use(errorHandler);
  return app;
};

describe('Company Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /api/companies', () => {
    it('should list user companies', async () => {
      const response = await request(app).get('/api/companies');
      expect(response.status).toBe(200);
    });

    it('should return 400 without userId in context', async () => {
      const noUserApp = express();
      noUserApp.use(express.json());
      noUserApp.use((req, _res, next) => {
        req.context = { companyId: 'test-company' };
        next();
      });
      noUserApp.use('/api/companies', companyRouter);
      noUserApp.use(errorHandler);

      const response = await request(noUserApp).get('/api/companies');
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/companies', () => {
    it('should create a company', async () => {
      const response = await request(app)
        .post('/api/companies')
        .send({ name: 'New Company' });
      expect(response.status).toBe(201);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/companies')
        .send({});
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/companies/join', () => {
    it('should join company with invite code', async () => {
      const response = await request(app)
        .post('/api/companies/join')
        .send({ inviteCode: 'ABC123' });
      expect(response.status).toBe(200);
    });

    it('should return 401 without userId', async () => {
      const noUserApp = express();
      noUserApp.use(express.json());
      noUserApp.use((req, _res, next) => {
        req.context = { companyId: 'test-company' };
        next();
      });
      noUserApp.use('/api/companies', companyRouter);
      noUserApp.use(errorHandler);

      const response = await request(noUserApp)
        .post('/api/companies/join')
        .send({ inviteCode: 'ABC123' });
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/companies/:id', () => {
    it('should get company by ID', async () => {
      mockCompanyService.getById.mockResolvedValue({
        id: 'comp-1',
        name: 'Test Company',
      });
      const response = await request(app).get(
        '/api/companies/comp-1'
      );
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent company', async () => {
      mockCompanyService.getById.mockResolvedValue(null);
      const response = await request(app).get(
        '/api/companies/not-found'
      );
      expect(response.status).toBe(404);
    });
  });
});
