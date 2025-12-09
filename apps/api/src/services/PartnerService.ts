import { prisma, PartnerType } from '@sync-erp/database';
import type { Partner } from '@sync-erp/database';

interface CreatePartnerInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  type: PartnerType;
}

interface UpdatePartnerInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export class PartnerService {
  /**
   * Create a new partner (supplier or customer)
   */
  async create(companyId: string, data: CreatePartnerInput): Promise<Partner> {
    return prisma.partner.create({
      data: {
        companyId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        type: data.type,
      },
    });
  }

  /**
   * Get partner by ID
   */
  async getById(id: string, companyId: string): Promise<Partner | null> {
    return prisma.partner.findFirst({
      where: { id, companyId },
    });
  }

  /**
   * List all partners for a company, optionally filtered by type
   */
  async list(companyId: string, type?: PartnerType): Promise<Partner[]> {
    return prisma.partner.findMany({
      where: {
        companyId,
        ...(type && { type }),
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * List suppliers only
   */
  async listSuppliers(companyId: string): Promise<Partner[]> {
    return this.list(companyId, PartnerType.SUPPLIER);
  }

  /**
   * List customers only
   */
  async listCustomers(companyId: string): Promise<Partner[]> {
    return this.list(companyId, PartnerType.CUSTOMER);
  }

  /**
   * Update partner
   */
  async update(id: string, companyId: string, data: UpdatePartnerInput): Promise<Partner> {
    // Verify partner belongs to company
    const existing = await this.getById(id, companyId);
    if (!existing) {
      throw new Error('Partner not found');
    }

    return prisma.partner.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
      },
    });
  }

  /**
   * Delete partner
   */
  async delete(id: string, companyId: string): Promise<void> {
    const existing = await this.getById(id, companyId);
    if (!existing) {
      throw new Error('Partner not found');
    }

    await prisma.partner.delete({
      where: { id },
    });
  }
}
