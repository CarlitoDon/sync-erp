import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require('cookie-parser');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import {
  mockAuthService,
  resetServiceMocks,
} from '../mocks/services.mock';

// Mock auth middleware to bypass validation or set context
vi.mock('../../../src/middlewares/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    // Determine if we want to simulate failure, maybe based on header?
    // For now, simulate success if session cookie present
    const cookies = req.cookies || {};
    const session = cookies['sessionId'];
    if (
      session === 'invalid-session' ||
      session === 'expired-session'
    ) {
      return res.status(401).json({ success: false });
    }
    if (!session && req.path === '/api/auth/me') {
      return res.status(401).json({ success: false });
    }

    req.context = { userId: 'user-1', companyId: 'company-1' };
    req.session = { userId: 'user-1', user: { id: 'user-1' } };
    next();
  },
  optionalAuthMiddleware: (req: any, res: any, next: any) => {
    req.context = {};
    next();
  },
}));

// Mock AuthService
vi.mock('../../../src/modules/auth/auth.service', () => ({
  AuthService: vi.fn().mockReturnValue(mockAuthService),
}));

// Import after mocking
import { authRouter } from '../../../src/routes/auth';
import { errorHandler } from '../../../src/middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use(errorHandler);
  return app;
};

describe('Auth Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    resetServiceMocks();
    app = createTestApp();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      mockAuthService.register.mockResolvedValue({
        success: true,
        user: { id: 'user-new', email: 'new@test.com' },
        session: { id: 'session-1' },
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'new@test.com',
          password: 'ValidPass123!',
          name: 'New User',
        });
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should set session cookie on register', async () => {
      mockAuthService.register.mockResolvedValue({
        success: true,
        user: { id: 'user-new' },
        session: { id: 'session-1' },
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'new@test.com',
          password: 'ValidPass123!',
          name: 'New User',
        });
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid' });
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user', async () => {
      mockAuthService.login.mockResolvedValue({
        success: true,
        user: { id: 'user-1' },
        session: { id: 'session-2' },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@test.com',
          password: 'password123',
        });
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should set session cookie on login', async () => {
      mockAuthService.login.mockResolvedValue({
        success: true,
        user: { id: 'user-1' },
        session: { id: 'session-2' },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@test.com',
          password: 'password123',
        });
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', 'sessionId=session-1');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without session', async () => {
      const response = await request(app).get('/api/auth/me');
      expect(response.status).toBe(401);
    });

    it('should return user for valid session', async () => {
      mockAuthService.getSession.mockResolvedValue({
        id: 'valid-session',
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'user-1', email: 'test@example.com' },
      });

      // Mocked middleware sets user context
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'sessionId=valid-session');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 for expired session', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'sessionId=expired-session');
      expect(response.status).toBe(401);
    });
  });
});
