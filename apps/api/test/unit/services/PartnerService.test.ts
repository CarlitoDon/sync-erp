import { vi } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module

// Import after mocking
import { PartnerService } from '../../../src/services/PartnerService';

describe('PartnerService', () => {
  let service: PartnerService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetMocks();
    service = new PartnerService();
  });

  describe('create', () => {
    it('should create a supplier partner', async () => {
      const mockPartner = {
        id: 'partner-1',
        companyId,
        name: 'Supplier Inc',
        email: 'supplier@example.com',
        type: 'SUPPLIER',
      };

      mockPrisma.partner.create.mockResolvedValue(mockPartner);

      const result = await service.create(companyId, {
        name: 'Supplier Inc',
        email: 'supplier@example.com',
        type: 'SUPPLIER' as any,
      });

      expect(result).toEqual(mockPartner);
      expect(mockPrisma.partner.create).toHaveBeenCalledWith({
        data: {
          companyId,
          name: 'Supplier Inc',
          email: 'supplier@example.com',
          phone: undefined,
          address: undefined,
          type: 'SUPPLIER',
        },
      });
    });

    it('should create a customer partner', async () => {
      const mockPartner = {
        id: 'partner-2',
        companyId,
        name: 'Customer Corp',
        type: 'CUSTOMER',
      };

      mockPrisma.partner.create.mockResolvedValue(mockPartner);

      const result = await service.create(companyId, {
        name: 'Customer Corp',
        type: 'CUSTOMER' as any,
      });

      expect(result.type).toBe('CUSTOMER');
    });
  });

  describe('getById', () => {
    it('should return a partner by ID and companyId', async () => {
      const mockPartner = { id: 'partner-1', companyId, name: 'Test Partner' };
      mockPrisma.partner.findFirst.mockResolvedValue(mockPartner);

      const result = await service.getById('partner-1', companyId);

      expect(result).toEqual(mockPartner);
      expect(mockPrisma.partner.findFirst).toHaveBeenCalledWith({
        where: { id: 'partner-1', companyId },
      });
    });

    it('should return null for non-existent partner', async () => {
      mockPrisma.partner.findFirst.mockResolvedValue(null);

      const result = await service.getById('non-existent', companyId);

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all partners for a company', async () => {
      const mockPartners = [
        { id: 'partner-1', name: 'Partner A', type: 'SUPPLIER' },
        { id: 'partner-2', name: 'Partner B', type: 'CUSTOMER' },
      ];

      mockPrisma.partner.findMany.mockResolvedValue(mockPartners);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
      expect(mockPrisma.partner.findMany).toHaveBeenCalledWith({
        where: { companyId },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter partners by type', async () => {
      const mockSuppliers = [{ id: 'partner-1', name: 'Supplier', type: 'SUPPLIER' }];

      mockPrisma.partner.findMany.mockResolvedValue(mockSuppliers);

      const result = await service.list(companyId, 'SUPPLIER' as any);

      expect(result).toHaveLength(1);
      expect(mockPrisma.partner.findMany).toHaveBeenCalledWith({
        where: { companyId, type: 'SUPPLIER' },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('listSuppliers', () => {
    it('should list only suppliers', async () => {
      const mockSuppliers = [{ id: 'partner-1', name: 'Supplier', type: 'SUPPLIER' }];
      mockPrisma.partner.findMany.mockResolvedValue(mockSuppliers);

      const result = await service.listSuppliers(companyId);

      expect(result).toHaveLength(1);
    });
  });

  describe('listCustomers', () => {
    it('should list only customers', async () => {
      const mockCustomers = [{ id: 'partner-2', name: 'Customer', type: 'CUSTOMER' }];
      mockPrisma.partner.findMany.mockResolvedValue(mockCustomers);

      const result = await service.listCustomers(companyId);

      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('should update an existing partner', async () => {
      const existingPartner = { id: 'partner-1', companyId, name: 'Old Name' };
      const updatedPartner = { id: 'partner-1', companyId, name: 'New Name' };

      mockPrisma.partner.findFirst.mockResolvedValue(existingPartner);
      mockPrisma.partner.update.mockResolvedValue(updatedPartner);

      const result = await service.update('partner-1', companyId, { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(mockPrisma.partner.update).toHaveBeenCalledWith({
        where: { id: 'partner-1' },
        data: { name: 'New Name', email: undefined, phone: undefined, address: undefined },
      });
    });

    it('should throw error if partner not found', async () => {
      mockPrisma.partner.findFirst.mockResolvedValue(null);

      await expect(service.update('non-existent', companyId, { name: 'New' })).rejects.toThrow(
        'Partner not found'
      );
    });
  });

  describe('delete', () => {
    it('should delete an existing partner', async () => {
      const existingPartner = { id: 'partner-1', companyId, name: 'To Delete' };
      mockPrisma.partner.findFirst.mockResolvedValue(existingPartner);
      mockPrisma.partner.delete.mockResolvedValue(existingPartner);

      await service.delete('partner-1', companyId);

      expect(mockPrisma.partner.delete).toHaveBeenCalledWith({
        where: { id: 'partner-1' },
      });
    });

    it('should throw error if partner not found', async () => {
      mockPrisma.partner.findFirst.mockResolvedValue(null);

      await expect(service.delete('non-existent', companyId)).rejects.toThrow('Partner not found');
    });
  });
});
