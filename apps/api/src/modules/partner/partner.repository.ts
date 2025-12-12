import { prisma, type Partner, Prisma, PartnerType } from '@sync-erp/database';

export class PartnerRepository {
  async create(data: Prisma.PartnerCreateManyInput): Promise<Partner> {
    return prisma.partner.create({ data });
  }

  async findById(id: string, companyId?: string): Promise<Partner | null> {
    const where: Prisma.PartnerWhereInput = { id };
    if (companyId) {
      where.companyId = companyId;
    }
    return prisma.partner.findFirst({ where });
  }

  async findAll(companyId: string, type?: PartnerType): Promise<Partner[]> {
    return prisma.partner.findMany({
      where: {
        companyId,
        ...(type && { type }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, data: Prisma.PartnerUpdateInput): Promise<Partner> {
    return prisma.partner.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Partner> {
    return prisma.partner.delete({
      where: { id },
    });
  }
}
