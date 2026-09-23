import {
  Prisma,
  prisma,
  type Partner,
  type Address,
  PartnerType,
} from '@sync-erp/database';
import { CreateAddressInput } from '@sync-erp/shared';

export class PartnerRepository {
  async create(
    data: Prisma.PartnerCreateManyInput
  ): Promise<Partner> {
    return prisma.partner.create({ data });
  }

  async findById(
    id: string,
    companyId: string
  ): Promise<(Partner & { addresses: Address[] }) | null> {
    return prisma.partner.findFirst({
      where: { id, companyId },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
  }

  async findAll(
    companyId: string,
    type?: PartnerType
  ): Promise<(Partner & { addresses: Address[] })[]> {
    return prisma.partner.findMany({
      where: {
        companyId,
        ...(type && { type }),
      },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
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

        // Re-link Address
        await tx.address.updateMany({
          where: { partnerId: sourceId, companyId },
          data: { partnerId: targetPartnerId },
        });

        // Delete source partner
        await tx.partner.delete({
          where: { id: sourceId },
        });
      }

      return target;
    });
  }

  async listAddresses(
    partnerId: string,
    companyId: string
  ): Promise<Address[]> {
    const addresses = await prisma.address.findMany({
      where: { partnerId, companyId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    if (addresses.length === 0) {
      // Check if partner has legacy address stored in Partner table
      const partner = await prisma.partner.findFirst({
        where: { id: partnerId, companyId },
      });
      if (partner && (partner.address || partner.street)) {
        const migrated = await prisma.address.create({
          data: {
            companyId,
            partnerId,
            name: 'Alamat Utama',
            isDefault: true,
            address: partner.address,
            street: partner.street,
            kelurahan: partner.kelurahan,
            kecamatan: partner.kecamatan,
            kota: partner.kota,
            provinsi: partner.provinsi,
            zip: partner.zip,
            latitude: partner.latitude,
            longitude: partner.longitude,
          },
        });
        return [migrated];
      }
    }

    return addresses;
  }

  async createAddress(
    companyId: string,
    data: CreateAddressInput
  ): Promise<Address> {
    return prisma.$transaction(async (tx) => {
      const count = await tx.address.count({
        where: { partnerId: data.partnerId, companyId },
      });
      // First address must always be default; otherwise respect requested flag
      const isDefault = count === 0 ? true : (data.isDefault ?? false);

      if (isDefault && count > 0) {
        await tx.address.updateMany({
          where: { partnerId: data.partnerId, companyId },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          companyId,
          partnerId: data.partnerId,
          name: data.name,
          isDefault,
          address: data.address,
          street: data.street,
          kelurahan: data.kelurahan,
          kecamatan: data.kecamatan,
          kota: data.kota,
          provinsi: data.provinsi,
          zip: data.zip,
          latitude:
            data.latitude !== undefined && data.latitude !== null
              ? new Prisma.Decimal(data.latitude)
              : undefined,
          longitude:
            data.longitude !== undefined && data.longitude !== null
              ? new Prisma.Decimal(data.longitude)
              : undefined,
        },
      });
    });
  }

  async setDefaultAddress(
    id: string,
    partnerId: string,
    companyId: string
  ): Promise<Address> {
    return prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { partnerId, companyId },
        data: { isDefault: false },
      });
      return tx.address.update({
        where: { id },
        data: { isDefault: true },
      });
    });
  }

  async deleteAddress(
    id: string,
    companyId: string
  ): Promise<Address> {
    const existing = await prisma.address.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new Error('Alamat tidak ditemukan');
    }
    const deleted = await prisma.address.delete({
      where: { id },
    });

    // If the deleted address was default, promote the newest remaining address to default
    if (existing.isDefault) {
      const remaining = await prisma.address.findFirst({
        where: { partnerId: existing.partnerId, companyId },
        orderBy: { createdAt: 'desc' },
      });
      if (remaining) {
        await prisma.address.update({
          where: { id: remaining.id },
          data: { isDefault: true },
        });
      }
    }

    return deleted;
  }
}
