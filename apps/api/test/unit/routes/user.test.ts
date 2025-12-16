import { vi, describe, beforeEach, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  mockUserService,
  resetServiceMocks,
} from '../mocks/services.mock';

// Mock UserService
vi.mock('../../../src/modules/user/user.service', () => ({
  UserService: function () {
    return mockUserService;
  },
}));

// Import after mocking
import { userRouter } from '../../../src/routes/user';
import { errorHandler } from '../../../src/middlewares/errorHandler';

// Helper to create test app with mocked context
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Mock auth middleware
  app.use((req: any, _res, next) => {
    req.context = {
      userId: 'test-user',
      companyId: 'test-company',
    };
    next();
  });

  app.use('/api/users', userRouter);
  app.use(errorHandler);
  return app;
};

describe('User Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    resetServiceMocks();

    // Setup default mock responses
    mockUserService.listByCompany.mockResolvedValue([
      { id: 'user-1', email: 'user1@example.com', name: 'User 1' },
      { id: 'user-2', email: 'user2@example.com', name: 'User 2' },
    ]);
    mockUserService.create.mockResolvedValue({
      id: 'user-new',
      email: 'new@example.com',
      name: 'New User',
    });
    mockUserService.getByEmail.mockResolvedValue(null);
    mockUserService.assignToCompany.mockResolvedValue({
      userId: 'user-1',
      companyId: 'company-1',
    });

    app = createTestApp();
  });

  describe('GET /api/users', () => {
    it('should list users in company', async () => {
      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ email: 'new@example.com', name: 'New User' });

      // Controller create/invite returns 200 by default in current implementation
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('new@example.com');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ email: 'invalid', name: 'Test' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for short name', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ email: 'test@example.com', name: 'A' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/users/:userId/assign', () => {
    it('should assign user to company', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .post(`/api/users/${validUuid}/assign`)
        .send({
          userId: validUuid,
          companyId: 'company-1',
          roleId: validUuid,
        });

      // Controller assign returns 200
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
