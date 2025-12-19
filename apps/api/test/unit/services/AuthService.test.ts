import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockAuthRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';

// Mock UserService
const mockUserService = {
  getByEmail: vi.fn(),
  create: vi.fn(),
};
vi.mock('@modules/user/user.service', () => ({
  UserService: function () {
    return mockUserService;
  },
}));

// Mock auth.utils
vi.mock('@modules/auth/auth.utils', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
  comparePassword: vi.fn().mockResolvedValue(true),
}));

// Mock AuthRepository
vi.mock('@modules/auth/auth.repository', () => ({
  AuthRepository: function () {
    return mockAuthRepository;
  },
}));

// Import after mocking
import { AuthService } from '@modules/auth/auth.service';
import * as authUtils from '@modules/auth/auth.utils';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    resetRepositoryMocks();
    vi.clearAllMocks();
    service = new AuthService();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed-password',
      };
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(),
      };

      mockUserService.getByEmail.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue(mockUser);
      mockAuthRepository.createSession.mockResolvedValue(mockSession);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
    });

    it('should fail if email already exists', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'test@example.com',
      };

      mockUserService.getByEmail.mockResolvedValue(existingUser);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONFLICT');
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
      };
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(),
      };

      mockUserService.getByEmail.mockResolvedValue(mockUser);
      vi.mocked(authUtils.comparePassword).mockResolvedValue(true);
      mockAuthRepository.createSession.mockResolvedValue(mockSession);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
    });

    it('should fail with invalid email', async () => {
      mockUserService.getByEmail.mockResolvedValue(null);

      const result = await service.login({
        email: 'wrong@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should fail with invalid password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
      };

      mockUserService.getByEmail.mockResolvedValue(mockUser);
      vi.mocked(authUtils.comparePassword).mockResolvedValue(false);

      const result = await service.login({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });
  });

  describe('logout', () => {
    it('should delete session on logout', async () => {
      const mockSession = { id: 'session-1', userId: 'user-1' };
      mockAuthRepository.deleteSession.mockResolvedValue(mockSession);

      const result = await service.logout('session-1');

      expect(result).toEqual(mockSession);
      expect(mockAuthRepository.deleteSession).toHaveBeenCalledWith(
        'session-1'
      );
    });
  });

  describe('getSession', () => {
    it('should return session with user', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        user: { id: 'user-1', email: 'test@example.com' },
        expiresAt: new Date(),
      };

      mockAuthRepository.getSession.mockResolvedValue(mockSession);

      const result = await service.getSession('session-1');

      expect(result).toEqual(mockSession);
    });

    it('should return null for non-existent session', async () => {
      mockAuthRepository.getSession.mockResolvedValue(null);

      const result = await service.getSession('non-existent');

      expect(result).toBeNull();
    });
  });
});
