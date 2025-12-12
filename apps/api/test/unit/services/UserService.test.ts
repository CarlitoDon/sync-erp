import { vi } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module

// Import after mocking
import { UserService } from '../../../src/services/UserService';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    resetMocks();
    service = new UserService();
  });

  describe('create', () => {
    it('should create a user without company assignment', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await service.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: '',
        },
      });
    });

    it('should create a user with company assignment', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: '',
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await service.create(
        { email: 'test@example.com', name: 'Test User' },
        'company-1'
      );

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: '',
          companies: {
            create: { companyId: 'company-1' },
          },
        },
      });
    });
  });

  describe('getById', () => {
    it('should return a user by ID', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getById('user-1');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should return null for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getById('non-existent');

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
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null for non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getByEmail(
        'nonexistent@example.com'
      );

      expect(result).toBeNull();
    });
  });

  describe('listByCompany', () => {
    it('should return all users in a company with their roles', async () => {
      const mockMembers = [
        {
          userId: 'user-1',
          companyId: 'company-1',
          user: {
            id: 'user-1',
            email: 'user1@example.com',
            name: 'User 1',
          },
          role: { id: 'role-1', name: 'Admin' },
        },
        {
          userId: 'user-2',
          companyId: 'company-1',
          user: {
            id: 'user-2',
            email: 'user2@example.com',
            name: 'User 2',
          },
          role: null,
        },
      ];

      mockPrisma.companyMember.findMany.mockResolvedValue(
        mockMembers
      );

      const result = await service.listByCompany('company-1');

      expect(result).toHaveLength(2);
      expect(result[0].role?.name).toBe('Admin');
      expect(result[1].role).toBeNull();
    });

    it('should return empty array for company with no users', async () => {
      mockPrisma.companyMember.findMany.mockResolvedValue([]);

      const result = await service.listByCompany('empty-company');

      expect(result).toEqual([]);
    });
  });

  describe('assignToCompany', () => {
    it('should assign a user to a company', async () => {
      const mockMember = {
        userId: 'user-1',
        companyId: 'company-1',
        roleId: null,
        user: { id: 'user-1', email: 'test@example.com' },
        company: { id: 'company-1', name: 'Test Company' },
        role: null,
      };

      mockPrisma.companyMember.create.mockResolvedValue(mockMember);

      const result = await service.assignToCompany(
        'user-1',
        'company-1'
      );

      expect(result).toEqual(mockMember);
      expect(mockPrisma.companyMember.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          companyId: 'company-1',
          roleId: undefined,
        },
        include: {
          user: true,
          company: true,
          role: true,
        },
      });
    });

    it('should assign a user to a company with a role', async () => {
      const mockMember = {
        userId: 'user-1',
        companyId: 'company-1',
        roleId: 'role-1',
        user: { id: 'user-1' },
        company: { id: 'company-1' },
        role: { id: 'role-1', name: 'Admin' },
      };

      mockPrisma.companyMember.create.mockResolvedValue(mockMember);

      const result = await service.assignToCompany(
        'user-1',
        'company-1',
        'role-1'
      );

      expect(result.roleId).toBe('role-1');
    });
  });

  describe('removeFromCompany', () => {
    it('should remove a user from a company', async () => {
      const mockDeleted = {
        userId: 'user-1',
        companyId: 'company-1',
      };
      mockPrisma.companyMember.delete.mockResolvedValue(mockDeleted);

      const result = await service.removeFromCompany(
        'user-1',
        'company-1'
      );

      expect(result).toEqual(mockDeleted);
      expect(mockPrisma.companyMember.delete).toHaveBeenCalledWith({
        where: {
          userId_companyId: {
            userId: 'user-1',
            companyId: 'company-1',
          },
        },
      });
    });
  });
});
