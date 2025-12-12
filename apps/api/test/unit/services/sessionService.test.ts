import { vi } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module

// Import after mocking
import {
  createSession,
  getSession,
  deleteSession,
  deleteUserSessions,
} from '../../../src/services/sessionService';

describe('sessionService', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('createSession', () => {
    it('should create a new session with 7-day expiry', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };

      mockPrisma.session.create.mockResolvedValue(mockSession);

      const result = await createSession('user-1');

      expect(result).toEqual(mockSession);
      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          expiresAt: expect.any(Date),
        },
      });

      // Verify expiresAt is approximately 7 days in the future
      const callData =
        mockPrisma.session.create.mock.calls[0][0].data;
      const daysDiff =
        (callData.expiresAt.getTime() - Date.now()) /
        (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(7, 0);
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

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      const result = await getSession('session-1');

      expect(result).toEqual(mockSession);
      expect(result?.user).toBeDefined();
      expect(mockPrisma.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        include: { user: true },
      });
    });

    it('should return null for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const result = await getSession('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const mockSession = { id: 'session-1', userId: 'user-1' };
      mockPrisma.session.delete.mockResolvedValue(mockSession);

      const result = await deleteSession('session-1');

      expect(result).toEqual(mockSession);
      expect(mockPrisma.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });
  });

  describe('deleteUserSessions', () => {
    it('should delete all sessions for a user', async () => {
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 3 });

      const result = await deleteUserSessions('user-1');

      expect(result).toEqual({ count: 3 });
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });
});
