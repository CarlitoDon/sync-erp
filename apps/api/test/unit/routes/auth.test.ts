import { vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Mock authService
vi.mock('../../../src/services/authService', () => ({
  register: vi.fn().mockResolvedValue({
    success: true,
    user: { id: 'user-new', email: 'new@test.com', name: 'New User' },
    session: { id: 'session-1' },
  }),
  login: vi.fn().mockResolvedValue({
    success: true,
    user: { id: 'user-1', email: 'user@test.com', name: 'Test User' },
    session: { id: 'session-2' },
  }),
}));

// Mock sessionService
vi.mock('../../../src/services/sessionService', () => ({
  deleteSession: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn().mockImplementation((sessionId: string) => {
    if (sessionId === 'valid-session') {
      return Promise.resolve({
        id: 'valid-session',
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
        user: { id: 'user-1', email: 'user@test.com', name: 'Test User' },
      });
    }
    if (sessionId === 'expired-session') {
      return Promise.resolve({
        id: 'expired-session',
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago
        user: { id: 'user-1', email: 'user@test.com', name: 'Test User' },
      });
    }
    return Promise.resolve(null);
  }),
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
    app = createTestApp();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'new@test.com',
        password: 'ValidPass123!',
        name: 'New User',
      });
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should set session cookie on register', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'new@test.com',
        password: 'ValidPass123!',
        name: 'New User',
      });
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app).post('/api/auth/register').send({ email: 'invalid' });
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'user@test.com',
        password: 'password123',
      });
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should set session cookie on login', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'user@test.com',
        password: 'password123',
      });
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', 'sessionId=session-1');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should clear session cookie on logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', 'sessionId=session-1');
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without session', async () => {
      const response = await request(app).get('/api/auth/me');
      expect(response.status).toBe(401);
    });

    it('should return user for valid session', async () => {
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

    it('should return 401 for invalid session', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'sessionId=invalid-session');
      expect(response.status).toBe(401);
    });
  });
});
