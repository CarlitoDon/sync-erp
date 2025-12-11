import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module
vi.mock('@sync-erp/database', () => ({
  prisma: mockPrisma,
}));

// Mock authUtil
vi.mock('../../../src/services/authUtil.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed_password'),
  comparePassword: vi.fn(),
}));

// Mock sessionService
vi.mock('../../../src/services/sessionService.js', () => ({
  createSession: vi.fn().mockResolvedValue({
    id: 'session-1',
    userId: 'user-1',
    token: 'test-token',
    expiresAt: new Date(Date.now() + 86400000),
  }),
}));

// Import after mocking
import { register, login, logout } from '../../../src/services/authService';
import { comparePassword } from '../../../src/services/authUtil.js';

describe('authService', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed_password',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(null); // No existing user
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.session).toBeDefined();
    });

    it('should return error if email already exists', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'existing@example.com',
        name: 'Existing User',
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      const result = await register({
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONFLICT');
      expect(result.error?.message).toBe('Email already exists');
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed_password',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (comparePassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const result = await login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.session).toBeDefined();
    });

    it('should return error for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await login({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return error for invalid password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (comparePassword as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await login({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });
  });

  describe('logout', () => {
    it('should handle logout (currently empty implementation)', async () => {
      // logout is currently empty in the implementation
      const result = await logout('session-1');
      expect(result).toBeUndefined();
    });
  });
});
