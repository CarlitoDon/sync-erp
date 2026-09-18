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

  async merge(
    companyId: string,
    targetPartnerId: string,
    sourcePartnerIds: string[]
  ): Promise<Partner> {
    return prisma.$transaction(async (tx) => {
      const target = await tx.partner.findFirst({
        where: { id: targetPartnerId, companyId },
      });
      if (!target) {
        throw new Error('Target partner not found');
      }

      for (const sourceId of sourcePartnerIds) {
        if (sourceId === targetPartnerId) continue;
        const source = await tx.partner.findFirst({
          where: { id: sourceId, companyId },
        });
        if (!source) continue;

        // Re-link RentalOrder
        await tx.rentalOrder.updateMany({
          where: { partnerId: sourceId, companyId },
          data: { partnerId: targetPartnerId },
        });

        // Re-link Order
        await tx.order.updateMany({
          where: { partnerId: sourceId, companyId },
          data: { partnerId: targetPartnerId },
        });

        // Re-link Invoice
        await tx.invoice.updateMany({
          where: { partnerId: sourceId, companyId },
          data: { partnerId: targetPartnerId },
        });

        // Re-link or merge CustomerRentalRisk
        const sourceRisk = await tx.customerRentalRisk.findUnique({
          where: { partnerId: sourceId },
        });
        if (sourceRisk) {
          const targetRisk = await tx.customerRentalRisk.findUnique({
            where: { partnerId: targetPartnerId },
          });
          if (targetRisk) {
            await tx.customerRentalRisk.update({
              where: { id: targetRisk.id },
              data: {
                totalRentals: targetRisk.totalRentals + sourceRisk.totalRentals,
                lateReturns: targetRisk.lateReturns + sourceRisk.lateReturns,
                damageIncidents: targetRisk.damageIncidents + sourceRisk.damageIncidents,
                depositForfeits: targetRisk.depositForfeits + sourceRisk.depositForfeits,
              },
            });
            await tx.customerRentalRisk.delete({
              where: { id: sourceRisk.id },
            });
          } else {
            await tx.customerRentalRisk.update({
              where: { id: sourceRisk.id },
              data: { partnerId: targetPartnerId },
            });
          }
        }

        // Delete source partner
        await tx.partner.delete({
          where: { id: sourceId },
        });
      }

      return target;
    });
  }
}
