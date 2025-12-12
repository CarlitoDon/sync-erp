import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockPartnerRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';

// Mock the PartnerRepository module
vi.mock('../../../src/modules/partner/partner.repository', () => ({
  PartnerRepository: vi
    .fn()
    .mockImplementation(() => mockPartnerRepository),
}));

// Import after mocking
import { PartnerService } from '../../../src/modules/partner/partner.service';

describe('PartnerService', () => {
  let service: PartnerService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetRepositoryMocks();
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

      mockPartnerRepository.create.mockResolvedValue(mockPartner);

      const result = await service.create(companyId, {
        name: 'Supplier Inc',
        email: 'supplier@example.com',
        type: 'SUPPLIER' as any,
      });

      expect(result).toEqual(mockPartner);
      expect(mockPartnerRepository.create).toHaveBeenCalledWith({
        companyId,
        name: 'Supplier Inc',
        email: 'supplier@example.com',
        phone: undefined,
        address: undefined,
        type: 'SUPPLIER',
      });
    });

    it('should create a customer partner', async () => {
      const mockPartner = {
        id: 'partner-2',
        companyId,
        name: 'Customer Corp',
        type: 'CUSTOMER',
      };

      mockPartnerRepository.create.mockResolvedValue(mockPartner);

      const result = await service.create(companyId, {
        name: 'Customer Corp',
        type: 'CUSTOMER' as any,
      });

      expect(result.type).toBe('CUSTOMER');
    });
  });

  describe('getById', () => {
    it('should return a partner by ID and companyId', async () => {
      const mockPartner = {
        id: 'partner-1',
        companyId,
        name: 'Test Partner',
      };
      mockPartnerRepository.findById.mockResolvedValue(mockPartner);

      const result = await service.getById('partner-1', companyId);

      expect(result).toEqual(mockPartner);
      expect(mockPartnerRepository.findById).toHaveBeenCalledWith(
        'partner-1',
        companyId
      );
    });

    it('should return null for non-existent partner', async () => {
      mockPartnerRepository.findById.mockResolvedValue(null);

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

      mockPartnerRepository.findAll.mockResolvedValue(mockPartners);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
      expect(mockPartnerRepository.findAll).toHaveBeenCalledWith(
        companyId,
        undefined
      );
    });

    it('should filter partners by type', async () => {
      const mockSuppliers = [
        { id: 'partner-1', name: 'Supplier', type: 'SUPPLIER' },
      ];

      mockPartnerRepository.findAll.mockResolvedValue(mockSuppliers);

      const result = await service.list(companyId, 'SUPPLIER' as any);

      expect(result).toHaveLength(1);
      expect(mockPartnerRepository.findAll).toHaveBeenCalledWith(
        companyId,
        'SUPPLIER'
      );
    });
  });

  describe('listSuppliers', () => {
    it('should list only suppliers', async () => {
      const mockSuppliers = [
        { id: 'partner-1', name: 'Supplier', type: 'SUPPLIER' },
      ];
      mockPartnerRepository.findAll.mockResolvedValue(mockSuppliers);

      const result = await service.listSuppliers(companyId);

      expect(result).toHaveLength(1);
    });
  });

  describe('listCustomers', () => {
    it('should list only customers', async () => {
      const mockCustomers = [
        { id: 'partner-2', name: 'Customer', type: 'CUSTOMER' },
      ];
      mockPartnerRepository.findAll.mockResolvedValue(mockCustomers);

      const result = await service.listCustomers(companyId);

      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('should update an existing partner', async () => {
      const existingPartner = {
        id: 'partner-1',
        companyId,
        name: 'Old Name',
      };
      const updatedPartner = {
        id: 'partner-1',
        companyId,
        name: 'New Name',
      };

      mockPartnerRepository.findById.mockResolvedValue(
        existingPartner
      );
      mockPartnerRepository.update.mockResolvedValue(updatedPartner);

      const result = await service.update('partner-1', companyId, {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
      expect(mockPartnerRepository.update).toHaveBeenCalledWith(
        'partner-1',
        {
          name: 'New Name',
        }
      );
    });

    it('should throw error if partner not found', async () => {
      mockPartnerRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('non-existent', companyId, { name: 'New' })
      ).rejects.toThrow('Partner not found');
    });
  });

  describe('delete', () => {
    it('should delete an existing partner', async () => {
      const existingPartner = {
        id: 'partner-1',
        companyId,
        name: 'To Delete',
      };
      mockPartnerRepository.findById.mockResolvedValue(
        existingPartner
      );
      mockPartnerRepository.delete.mockResolvedValue(existingPartner);

      await service.delete('partner-1', companyId);

      expect(mockPartnerRepository.delete).toHaveBeenCalledWith(
        'partner-1'
      );
    });

    it('should throw error if partner not found', async () => {
      mockPartnerRepository.findById.mockResolvedValue(null);

      await expect(
        service.delete('non-existent', companyId)
      ).rejects.toThrow('Partner not found');
    });
  });
});
