import {
  prisma,
  PartnerType,
  Prisma,
} from '@sync-erp/database';
import type { RentalIntegrationCustomerInput } from '../rental-integration.schemas';
import type { UpdatePublicOrderInput } from './external-order.types.js';

export class ExternalOrderPartnerService {
  async findOrCreateCustomer(
    companyId: string,
    input: RentalIntegrationCustomerInput
  ) {
    const normalizedPhone = this.normalizePhone(input.phone);

    let partner = await prisma.partner.findFirst({
      where: {
        companyId,
        phone: normalizedPhone,
      },
    });

    const nextData = {
      companyId,
      name: input.name,
      phone: normalizedPhone,
      email: input.email,
      address: input.address,
      street: input.street,
      kelurahan: input.kelurahan,
      kecamatan: input.kecamatan,
      kota: input.kota,
      provinsi: input.provinsi,
      zip: input.zip,
      latitude: input.latitude,
      longitude: input.longitude,
      type: PartnerType.CUSTOMER,
    };

    if (!partner) {
      return prisma.partner.create({ data: nextData });
    }

    const addressChanged =
      (input.address !== undefined &&
        input.address !== partner.address) ||
      (input.street !== undefined && input.street !== partner.street) ||
      (input.kelurahan !== undefined &&
        input.kelurahan !== partner.kelurahan) ||
      (input.kecamatan !== undefined &&
        input.kecamatan !== partner.kecamatan) ||
      (input.kota !== undefined && input.kota !== partner.kota) ||
      (input.provinsi !== undefined &&
        input.provinsi !== partner.provinsi) ||
      (input.zip !== undefined && input.zip !== partner.zip) ||
      (input.latitude !== undefined &&
        input.latitude !==
          (partner.latitude === null
            ? undefined
            : Number(partner.latitude))) ||
      (input.longitude !== undefined &&
        input.longitude !==
          (partner.longitude === null
            ? undefined
            : Number(partner.longitude)));

    if (input.name !== partner.name || addressChanged) {
      partner = await prisma.partner.create({ data: nextData });
    }

    return partner;
  }

  async resolvePartnerForOrderUpdate(
    order: {
      partnerId: string;
      companyId: string;
      partner: {
        type: PartnerType;
        name: string;
        email: string | null;
        phone: string | null;
        address: string | null;
        street: string | null;
        kelurahan: string | null;
        kecamatan: string | null;
        kota: string | null;
        provinsi: string | null;
        zip: string | null;
        latitude: Prisma.Decimal | null;
        longitude: Prisma.Decimal | null;
      };
    },
    input: UpdatePublicOrderInput
  ): Promise<string> {
    const partnerUpdate = this.buildPartnerUpdateData(input);

    if (Object.keys(partnerUpdate).length === 0) {
      return order.partnerId;
    }

    const linkedOrdersCount = await prisma.rentalOrder.count({
      where: { partnerId: order.partnerId },
    });

    if (linkedOrdersCount <= 1) {
      await this.updatePartnerFromInput(order.partnerId, input);
      return order.partnerId;
    }

    const clonedPartner = await prisma.partner.create({
      data: {
        companyId: order.companyId,
        type: order.partner.type,
        name: input.customerName ?? order.partner.name,
        email: order.partner.email,
        phone: input.customerPhone
          ? this.normalizePhone(input.customerPhone)
          : order.partner.phone,
        address: input.deliveryAddress ?? order.partner.address,
        street: input.street ?? order.partner.street,
        kelurahan: input.kelurahan ?? order.partner.kelurahan,
        kecamatan: input.kecamatan ?? order.partner.kecamatan,
        kota: input.kota ?? order.partner.kota,
        provinsi: input.provinsi ?? order.partner.provinsi,
        zip: input.zip ?? order.partner.zip,
        latitude: input.latitude ?? order.partner.latitude,
        longitude: input.longitude ?? order.partner.longitude,
      },
      select: {
        id: true,
      },
    });

    return clonedPartner.id;
  }

  async updatePartnerFromInput(
    partnerId: string,
    input: UpdatePublicOrderInput
  ): Promise<void> {
    const partnerUpdate = this.buildPartnerUpdateData(input);

    if (Object.keys(partnerUpdate).length === 0) {
      return;
    }

    await prisma.partner.update({
      where: { id: partnerId },
      data: partnerUpdate,
    });
  }

  buildPartnerUpdateData(input: UpdatePublicOrderInput): Record<string, unknown> {
    const partnerUpdate: Record<string, unknown> = {};

    if (input.customerName !== undefined) {
      partnerUpdate.name = input.customerName;
    }
    if (input.customerPhone !== undefined) {
      partnerUpdate.phone = this.normalizePhone(input.customerPhone);
    }
    if (input.deliveryAddress !== undefined) {
      partnerUpdate.address = input.deliveryAddress;
    }
    if (input.street !== undefined) {
      partnerUpdate.street = input.street;
    }
    if (input.kelurahan !== undefined) {
      partnerUpdate.kelurahan = input.kelurahan;
    }
    if (input.kecamatan !== undefined) {
      partnerUpdate.kecamatan = input.kecamatan;
    }
    if (input.kota !== undefined) {
      partnerUpdate.kota = input.kota;
    }
    if (input.provinsi !== undefined) {
      partnerUpdate.provinsi = input.provinsi;
    }
    if (input.zip !== undefined) {
      partnerUpdate.zip = input.zip;
    }
    if (input.latitude !== undefined) {
      partnerUpdate.latitude = input.latitude;
    }
    if (input.longitude !== undefined) {
      partnerUpdate.longitude = input.longitude;
    }

    return partnerUpdate;
  }

  normalizePhone(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      return `62${digits.slice(1)}`;
    }

    return digits;
  }
}
