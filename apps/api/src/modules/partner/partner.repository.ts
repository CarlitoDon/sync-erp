import {
  Prisma,
  prisma,
  type Partner,
  PartnerType,
} from '@sync-erp/database';

export class PartnerRepository {
  async create(
    data: Prisma.PartnerCreateManyInput
  ): Promise<Partner> {
    return prisma.partner.create({ data });
  }

  async findById(
    id: string,
    companyId: string
  ): Promise<Partner | null> {
    return prisma.partner.findFirst({
      where: { id, companyId },
    });
  }

  async findAll(
    companyId: string,
    type?: PartnerType
  ): Promise<Partner[]> {
    return prisma.partner.findMany({
      where: {
        companyId,
        ...(type && { type }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async update(
    id: string,
    data: Prisma.PartnerUpdateInput
  ): Promise<Partner> {
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
