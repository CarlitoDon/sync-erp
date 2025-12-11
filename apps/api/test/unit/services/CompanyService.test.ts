import { vi } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module

// Import after mocking
import { CompanyService } from '../../../src/services/CompanyService';

describe('CompanyService', () => {
  let service: CompanyService;

  beforeEach(() => {
    resetMocks();
    service = new CompanyService();
  });

  describe('create', () => {
    it('should create a company without a user', async () => {
      const mockCompany = {
        id: 'company-1',
        name: 'Test Company',
        inviteCode: 'ABC123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.company.create.mockResolvedValue(mockCompany);

      const result = await service.create({ name: 'Test Company' });

      expect(result).toEqual(mockCompany);
      expect(mockPrisma.company.create).toHaveBeenCalledWith({
        data: { name: 'Test Company' },
        include: { members: false },
      });
    });

    it('should create a company with a user as member', async () => {
      const mockCompany = {
        id: 'company-1',
        name: 'Test Company',
        inviteCode: 'ABC123',
        members: [{ userId: 'user-1', companyId: 'company-1' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.company.create.mockResolvedValue(mockCompany);

      const result = await service.create({ name: 'Test Company' }, 'user-1');

      expect(result).toEqual(mockCompany);
      expect(mockPrisma.company.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Company',
          members: {
            create: { userId: 'user-1' },
          },
        },
        include: { members: true },
      });
    });
  });

  describe('join', () => {
    it('should allow a user to join a company with valid invite code', async () => {
      const mockCompany = {
        id: 'company-1',
        name: 'Test Company',
        inviteCode: 'VALID123',
      };

      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      mockPrisma.companyMember.findUnique.mockResolvedValue(null); // Not a member
      mockPrisma.companyMember.create.mockResolvedValue({
        userId: 'user-1',
        companyId: 'company-1',
      });

      const result = await service.join({ inviteCode: 'VALID123' }, 'user-1');

      expect(result).toEqual(mockCompany);
      expect(mockPrisma.companyMember.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', companyId: 'company-1' },
      });
    });

    it('should throw error for invalid invite code', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(service.join({ inviteCode: 'INVALID' }, 'user-1')).rejects.toThrow(
        'Invalid invite code'
      );
    });

    it('should throw error if user is already a member', async () => {
      const mockCompany = { id: 'company-1', name: 'Test Company', inviteCode: 'VALID123' };

      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      mockPrisma.companyMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        companyId: 'company-1',
      }); // Already a member

      await expect(service.join({ inviteCode: 'VALID123' }, 'user-1')).rejects.toThrow(
        'User is already a member of this company'
      );
    });
  });

  describe('getById', () => {
    it('should return a company by ID', async () => {
      const mockCompany = { id: 'company-1', name: 'Test Company' };
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.getById('company-1');

      expect(result).toEqual(mockCompany);
      expect(mockPrisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: 'company-1' },
      });
    });

    it('should return null for non-existent company', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      const result = await service.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listForUser', () => {
    it('should return all companies for a user', async () => {
      const mockMemberships = [
        {
          userId: 'user-1',
          companyId: 'company-1',
          company: { id: 'company-1', name: 'Company A' },
        },
        {
          userId: 'user-1',
          companyId: 'company-2',
          company: { id: 'company-2', name: 'Company B' },
        },
      ];

      mockPrisma.companyMember.findMany.mockResolvedValue(mockMemberships);

      const result = await service.listForUser('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Company A');
      expect(result[1].name).toBe('Company B');
    });

    it('should return empty array for user with no companies', async () => {
      mockPrisma.companyMember.findMany.mockResolvedValue([]);

      const result = await service.listForUser('user-no-companies');

      expect(result).toEqual([]);
    });
  });

  describe('isMember', () => {
    it('should return true if user is a member', async () => {
      mockPrisma.companyMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        companyId: 'company-1',
      });

      const result = await service.isMember('user-1', 'company-1');

      expect(result).toBe(true);
    });

    it('should return false if user is not a member', async () => {
      mockPrisma.companyMember.findUnique.mockResolvedValue(null);

      const result = await service.isMember('user-1', 'company-1');

      expect(result).toBe(false);
    });
  });
});
