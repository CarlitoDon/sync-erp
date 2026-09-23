import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PartnerService } from '../../src/modules/partner/partner.service';
import { PartnerRepository } from '../../src/modules/partner/partner.repository';
import { PartnerType, type Partner } from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';

class MockPartnerRepository implements PartnerRepository {
  findById = vi.fn();
  findAll = vi.fn();
  create = vi.fn();
  update = vi.fn();
  delete = vi.fn();
  merge = vi.fn();
  listAddresses = vi.fn();
  createAddress = vi.fn();
  setDefaultAddress = vi.fn();
  deleteAddress = vi.fn();
}

describe('PartnerService', () => {
  let service: PartnerService;
  let mockRepo: MockPartnerRepository;

  const dummyPartner: Partner = {
    id: '11111111-1111-1111-1111-111111111111',
    companyId: 'company-1',
    type: PartnerType.CUSTOMER,
    name: 'Dewi',
    email: null,
    phone: '0812-8888-7648',
    address: 'patalan',
    street: null,
    kelurahan: null,
    kecamatan: null,
    kota: null,
    provinsi: null,
    zip: null,
    latitude: null,
    longitude: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepo = new MockPartnerRepository();
    service = new PartnerService(mockRepo);
  });

  describe('update', () => {
    it('throws DomainError if partner not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(
        service.update('non-existent', 'company-1', { name: 'New Name' })
      ).rejects.toThrow(DomainError);
    });

    it('updates partner successfully', async () => {
      mockRepo.findById.mockResolvedValue(dummyPartner);
      const updated = { ...dummyPartner, name: 'Dewi Updated' };
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(dummyPartner.id, 'company-1', {
        name: 'Dewi Updated',
      });
      expect(result.name).toBe('Dewi Updated');
      expect(mockRepo.update).toHaveBeenCalledWith(dummyPartner.id, {
        name: 'Dewi Updated',
      });
    });
  });

  describe('merge', () => {
    it('throws DomainError if target partner not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(
        service.merge('company-1', 'non-existent', ['source-id'])
      ).rejects.toThrow(DomainError);
    });

    it('delegates to repository.merge when target partner exists', async () => {
      mockRepo.findById.mockResolvedValue(dummyPartner);
      mockRepo.merge.mockResolvedValue(dummyPartner);

      const result = await service.merge('company-1', dummyPartner.id, ['source-2']);
      expect(result).toEqual(dummyPartner);
      expect(mockRepo.merge).toHaveBeenCalledWith('company-1', dummyPartner.id, ['source-2']);
    });
  });

  describe('address management', () => {
    const dummyAddress = {
      id: 'addr-1',
      companyId: 'company-1',
      partnerId: dummyPartner.id,
      label: 'Home',
      street: 'Jl. Malioboro No. 1',
      kelurahan: 'Sosromenduran',
      kecamatan: 'Gedongtengen',
      kota: 'Kota Yogyakarta',
      provinsi: 'Daerah Istimewa Yogyakarta',
      zip: '55271',
      latitude: null,
      longitude: null,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('listAddresses returns addresses from repository', async () => {
      mockRepo.listAddresses.mockResolvedValue([dummyAddress]);
      const result = await service.listAddresses(dummyPartner.id, 'company-1');
      expect(result).toEqual([dummyAddress]);
      expect(mockRepo.listAddresses).toHaveBeenCalledWith(dummyPartner.id, 'company-1');
    });

    it('createAddress throws DomainError if partner not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(
        service.createAddress('company-1', {
          partnerId: 'non-existent',
          street: 'Jl. Kaliurang',
          isDefault: false,
        })
      ).rejects.toThrow(DomainError);
    });

    it('createAddress calls repository when partner exists', async () => {
      mockRepo.findById.mockResolvedValue(dummyPartner);
      mockRepo.createAddress.mockResolvedValue(dummyAddress);

      const result = await service.createAddress('company-1', {
        partnerId: dummyPartner.id,
        street: 'Jl. Malioboro No. 1',
        isDefault: true,
      });

      expect(result).toEqual(dummyAddress);
      expect(mockRepo.createAddress).toHaveBeenCalledWith('company-1', {
        partnerId: dummyPartner.id,
        street: 'Jl. Malioboro No. 1',
        isDefault: true,
      });
    });

    it('setDefaultAddress delegates to repository', async () => {
      mockRepo.setDefaultAddress.mockResolvedValue(dummyAddress);
      const result = await service.setDefaultAddress('addr-1', dummyPartner.id, 'company-1');
      expect(result).toEqual(dummyAddress);
      expect(mockRepo.setDefaultAddress).toHaveBeenCalledWith('addr-1', dummyPartner.id, 'company-1');
    });

    it('deleteAddress delegates to repository', async () => {
      mockRepo.deleteAddress.mockResolvedValue(dummyAddress);
      const result = await service.deleteAddress('addr-1', 'company-1');
      expect(result).toEqual(dummyAddress);
      expect(mockRepo.deleteAddress).toHaveBeenCalledWith('addr-1', 'company-1');
    });
  });
});

