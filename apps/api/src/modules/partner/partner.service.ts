import { Partner, PartnerType } from '@sync-erp/database';
import { PartnerRepository } from './partner.repository';
import { CreatePartnerInput, UpdatePartnerInput } from '@sync-erp/shared';

export class PartnerService {
  private repository = new PartnerRepository();

  async create(companyId: string, data: CreatePartnerInput): Promise<Partner> {
    // Note: data.type is string in Input, but PartnerType enum in DB.
    // Zod schema validation ensures it matches ENUM strings.
    return this.repository.create({
      companyId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      type: data.type as PartnerType,
    });
  }

  async getById(id: string, companyId: string): Promise<Partner | null> {
    return this.repository.findById(id, companyId);
  }

  async list(companyId: string, type?: PartnerType): Promise<Partner[]> {
    return this.repository.findAll(companyId, type);
  }

  async listSuppliers(companyId: string): Promise<Partner[]> {
    return this.list(companyId, PartnerType.SUPPLIER);
  }

  async listCustomers(companyId: string): Promise<Partner[]> {
    return this.list(companyId, PartnerType.CUSTOMER);
  }

  async update(id: string, companyId: string, data: UpdatePartnerInput): Promise<Partner> {
    const existing = await this.getById(id, companyId);
    if (!existing) {
      throw new Error('Partner not found');
    }
    return this.repository.update(id, data);
  }

  async delete(id: string, companyId: string): Promise<void> {
    const existing = await this.getById(id, companyId);
    if (!existing) {
      throw new Error('Partner not found');
    }
    await this.repository.delete(id);
  }
}
