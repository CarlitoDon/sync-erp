import { Partner, Address, PartnerType } from '@sync-erp/database';
import { PartnerRepository } from './partner.repository';
import {
  CreatePartnerInput,
  UpdatePartnerInput,
  CreateAddressInput,
  DomainError,
  DomainErrorCodes,
} from '@sync-erp/shared';

export class PartnerService {
  constructor(
    private readonly repository: PartnerRepository = new PartnerRepository()
  ) {}

  async create(
    companyId: string,
    data: CreatePartnerInput
  ): Promise<Partner> {
    // Note: data.type is string in Input, but PartnerType enum in DB.
    // Zod schema validation ensures it matches ENUM strings.
    return this.repository.create({
      companyId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      street: data.street,
      kelurahan: data.kelurahan,
      kecamatan: data.kecamatan,
      kota: data.kota,
      provinsi: data.provinsi,
      zip: data.zip,
      type: data.type as PartnerType,
    });
  }

  async getById(
    id: string,
    companyId: string
  ): Promise<Partner | null> {
    return this.repository.findById(id, companyId);
  }

  async list(
    companyId: string,
    type?: PartnerType
  ): Promise<Partner[]> {
    return this.repository.findAll(companyId, type);
  }

  async listSuppliers(companyId: string): Promise<Partner[]> {
    return this.list(companyId, PartnerType.SUPPLIER);
  }

  async listCustomers(companyId: string): Promise<Partner[]> {
    return this.list(companyId, PartnerType.CUSTOMER);
  }

  async update(
    id: string,
    companyId: string,
    data: UpdatePartnerInput
  ): Promise<Partner> {
    const existing = await this.getById(id, companyId);
    if (!existing) {
      throw new DomainError(
        'Partner not found',
        404,
        DomainErrorCodes.PARTNER_NOT_FOUND
      );
    }
    return this.repository.update(id, data);
  }

  async delete(id: string, companyId: string): Promise<void> {
    const existing = await this.getById(id, companyId);
    if (!existing) {
      throw new DomainError(
        'Partner not found',
        404,
        DomainErrorCodes.PARTNER_NOT_FOUND
      );
    }
    await this.repository.delete(id);
  }

  async merge(
    companyId: string,
    targetPartnerId: string,
    sourcePartnerIds: string[]
  ): Promise<Partner> {
    const existing = await this.getById(targetPartnerId, companyId);
    if (!existing) {
      throw new DomainError(
        'Target partner not found',
        404,
        DomainErrorCodes.PARTNER_NOT_FOUND
      );
    }
    return this.repository.merge(companyId, targetPartnerId, sourcePartnerIds);
  }

  async listAddresses(
    partnerId: string,
    companyId: string
  ): Promise<Address[]> {
    return this.repository.listAddresses(partnerId, companyId);
  }

  async createAddress(
    companyId: string,
    data: CreateAddressInput
  ): Promise<Address> {
    const existing = await this.getById(data.partnerId, companyId);
    if (!existing) {
      throw new DomainError(
        'Partner not found',
        404,
        DomainErrorCodes.PARTNER_NOT_FOUND
      );
    }
    return this.repository.createAddress(companyId, data);
  }

  async setDefaultAddress(
    id: string,
    partnerId: string,
    companyId: string
  ): Promise<Address> {
    return this.repository.setDefaultAddress(id, partnerId, companyId);
  }

  async deleteAddress(
    id: string,
    companyId: string
  ): Promise<Address> {
    return this.repository.deleteAddress(id, companyId);
  }
}
