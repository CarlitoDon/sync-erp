import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockUserRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';

// Mock the UserRepository module
vi.mock('@modules/user/user.repository', () => ({
  UserRepository: function () {
    return mockUserRepository;
  },
}));

// Import after mocking
import { UserService } from '@modules/user/user.service';

describe('UserService', () => {
  let service: UserService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetRepositoryMocks();
    service = new UserService();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed',
      };

      mockUserRepository.create.mockResolvedValue(mockUser);

      const result = await service.create({
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed',
      });

      expect(result).toEqual(mockUser);
    });

    it('should create user with company assignment', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockUserRepository.create.mockResolvedValue(mockUser);

      const result = await service.create(
        {
          email: 'test@example.com',
          name: 'Test User',
        },
        companyId
      );

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          name: 'Test User',
          companies: {
            create: { companyId },
          },
        })
      );
    });
  });

  describe('getById', () => {
    it('should return a user by ID', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      };
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await service.getById('user-1');

      expect(result).toEqual(mockUser);
    });

    it('should return null for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getByEmail', () => {
    it('should return a user by email', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      };
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await service.getByEmail('test@example.com');

      expect(result).toEqual(mockUser);
    });
  });

  describe('listByCompany', () => {
    it('should list all users for a company', async () => {
      const mockMembers = [
        {
          user: {
            id: 'user-1',
            name: 'User 1',
            email: 'user1@example.com',
          },
          role: { id: 'role-1', name: 'Admin' },
        },
        {
          user: {
            id: 'user-2',
            name: 'User 2',
            email: 'user2@example.com',
          },
          role: null,
        },
      ];

      mockUserRepository.findMembersByCompany.mockResolvedValue(
        mockMembers
      );

      const result = await service.listByCompany(companyId);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('role');
    });
  });

  describe('assignToCompany', () => {
    it('should assign user to company', async () => {
      const mockMembership = {
        userId: 'user-1',
        companyId,
        roleId: 'role-1',
      };
      mockUserRepository.addMember.mockResolvedValue(mockMembership);

      const result = await service.assignToCompany(
        'user-1',
        companyId,
        'role-1'
      );

      expect(result).toEqual(mockMembership);
      expect(mockUserRepository.addMember).toHaveBeenCalledWith({
        userId: 'user-1',
        companyId,
        roleId: 'role-1',
      });
    });
  });

  describe('removeFromCompany', () => {
    it('should remove user from company', async () => {
      mockUserRepository.removeMember.mockResolvedValue({ count: 1 });

      await service.removeFromCompany('user-1', companyId);

      expect(mockUserRepository.removeMember).toHaveBeenCalledWith(
        'user-1',
        companyId
      );
    });
  });
});
