import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock UserService
vi.mock('../../../src/services/UserService', () => ({
  UserService: vi.fn().mockImplementation(() => ({
    listByCompany: vi.fn().mockResolvedValue([
      { id: 'user-1', email: 'user1@example.com', name: 'User 1' },
      { id: 'user-2', email: 'user2@example.com', name: 'User 2' },
    ]),
    create: vi.fn().mockResolvedValue({
      id: 'user-new',
      email: 'new@example.com',
      name: 'New User',
    }),
    assignToCompany: vi.fn().mockResolvedValue({
      userId: 'user-1',
      companyId: 'company-1',
    }),
  })),
}));

// Import after mocking
import { userRouter } from '../../../src/routes/user';
import { errorHandler } from '../../../src/middlewares/errorHandler';

// Helper to create test app with mocked context
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Mock auth middleware
  app.use((req, _res, next) => {
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
    vi.clearAllMocks();
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

      expect(response.status).toBe(201);
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
      const response = await request(app).post('/api/users/user-1/assign');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });
});
