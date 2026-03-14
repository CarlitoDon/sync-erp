import {
  prisma,
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
  Prisma,
  PartnerType,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import { DocumentNumberService } from '../common/services/document-number.service';
import { container, ServiceKeys } from '../common/di';
import type { RentalWebhookService } from './rental-webhook.service';

// Lazy resolve webhook service
const getWebhookService = (): RentalWebhookService | null => {
  try {
    return container.resolve<RentalWebhookService>(
      ServiceKeys.RENTAL_WEBHOOK_SERVICE
    );
  } catch {
    return null;
  }
};

export interface CreatePublicOrderInput {
  companyId: string;
  partnerId: string;
  rentalStartDate: Date;
  rentalEndDate: Date;
  items: {
    rentalItemId?: string;
    rentalBundleId?: string;
    quantity: number;
    name?: string;
    pricePerDay?: number;
    category?: 'package' | 'mattress' | 'accessory';
    components?: string[];
  }[];
  notes?: string;
  deliveryFee?: number;
  deliveryAddress?: string;
  street?: string;
  kelurahan?: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  paymentMethod?: string;
  discountAmount?: number;
  discountLabel?: string;
}

export interface UpdatePublicOrderInput {
  token: string;
  customerName?: string;
  customerPhone?: string;
  rentalStartDate?: Date;
  rentalEndDate?: Date;
  notes?: string;
  deliveryFee?: number;
  deliveryAddress?: string;
  street?: string;
  kelurahan?: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  paymentMethod?: string;
  discountAmount?: number;
  discountLabel?: string;
  items?: {
    rentalItemId?: string;
    rentalBundleId?: string;
    quantity: number;
    name?: string;
    pricePerDay?: number;
    category?: 'package' | 'mattress' | 'accessory';
    components?: string[];
  }[];
}

type ExternalOrderItemInput = CreatePublicOrderInput['items'][number];

type ResolvedOrderItem = {
  rentalItemId?: string;
  rentalBundleId?: string;
  quantity: number;
  unitPrice: Prisma.Decimal | number;
  subtotal: number;
  pricingTier: 'DAILY';
};

type RateBearingRecord = {
  id: string;
  dailyRate: Prisma.Decimal;
};

export class RentalExternalOrderService {
  private readonly documentNumberService =
    new DocumentNumberService();

  async getByToken(token: string) {
    const order = await prisma.rentalOrder.findFirst({
      where: { publicToken: token },
      include: {
        partner: {
          select: {
            name: true,
            phone: true,
            address: true,
            street: true,
            kelurahan: true,
            kecamatan: true,
            kota: true,
            provinsi: true,
            zip: true,
            latitude: true,
            longitude: true,
          },
        },
        items: {
          include: {
            rentalItem: {
              include: {
                product: {
                  select: {
                    name: true,
                    sku: true,
                  },
                },
              },
            },
            rentalBundle: {
              select: {
                name: true,
                shortName: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    return order;
  }

  async createOrder(input: CreatePublicOrderInput) {
    const durationDays = this.getDurationDays(
      input.rentalStartDate,
      input.rentalEndDate
    );

    const { subtotal, orderItems } = await this.buildOrderItems({
      companyId: input.companyId,
      items: input.items,
      durationDays,
      allowAutoCreate: true,
    });

    const finalSubtotal = subtotal - (input.discountAmount || 0);
    const totalAmount = finalSubtotal + (input.deliveryFee || 0);
    const orderNumber = await this.documentNumberService.generate(
      input.companyId,
      'RNT'
    );

    const order = await prisma.rentalOrder.create({
      data: {
        companyId: input.companyId,
        partnerId: input.partnerId,
        orderNumber,
        rentalStartDate: input.rentalStartDate,
        rentalEndDate: input.rentalEndDate,
        dueDateTime: input.rentalEndDate,
        publicToken: crypto.randomUUID(),
        status: RentalOrderStatus.DRAFT,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        subtotal,
        depositAmount: 0,
        totalAmount,
        policySnapshot: {},
        notes: input.notes,
        createdBy: 'santi-living-website',
        deliveryFee: input.deliveryFee,
        deliveryAddress: input.deliveryAddress,
        street: input.street,
        kelurahan: input.kelurahan,
        kecamatan: input.kecamatan,
        kota: input.kota,
        provinsi: input.provinsi,
        zip: input.zip,
        latitude: input.latitude,
        longitude: input.longitude,
        paymentMethod: input.paymentMethod,
        discountAmount: input.discountAmount,
        discountLabel: input.discountLabel,
        orderSource: OrderSource.WEBSITE,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: true,
        partner: {
          select: { name: true, phone: true },
        },
      },
    });

    const webhookService = getWebhookService();
    if (webhookService && order.publicToken) {
      try {
        await webhookService.notifyNewOrder(
          {
            companyId: input.companyId,
            token: order.publicToken,
            orderNumber: order.orderNumber,
            customerName: order.partner.name,
            customerPhone: order.partner.phone || '',
            totalAmount: Number(order.totalAmount),
          },
          { throwOnFailure: true }
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Unknown validation error';
        console.error(
          '[PublicRental] New order webhook/validation failed. Rolling back order:',
          errorMessage
        );

        try {
          await prisma.rentalOrderItem.deleteMany({
            where: { rentalOrderId: order.id },
          });
          await prisma.rentalOrder.deleteMany({
            where: { id: order.id },
          });
        } catch (rollbackErr) {
          console.warn(
            '[PublicRental] Rollback failed unexpectedly:',
            rollbackErr
          );
        }

        throw new DomainError(
          errorMessage ||
            'Gagal validasi pesanan (WhatsApp tidak valid)',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
    }

    return order;
  }

  async updateOrder(
    input: UpdatePublicOrderInput,
    expectedCompanyId?: string
  ) {
    const order = await prisma.rentalOrder.findFirst({
      where: { publicToken: input.token },
      include: { partner: true, items: true },
    });

    if (!order) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    if (
      expectedCompanyId &&
      order.companyId !== expectedCompanyId
    ) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    if (order.status !== RentalOrderStatus.DRAFT) {
      throw new DomainError(
        'Only draft orders can be updated',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    if (
      order.rentalPaymentStatus &&
      order.rentalPaymentStatus !== RentalPaymentStatus.PENDING
    ) {
      throw new DomainError(
        'Cannot update order with active payment',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    const nextPartnerId = await this.resolvePartnerForOrderUpdate(
      order,
      input
    );

    const startDate = input.rentalStartDate || order.rentalStartDate;
    const endDate = input.rentalEndDate || order.rentalEndDate;
    const durationDays = this.getDurationDays(startDate, endDate);

    let subtotal = Number(order.subtotal);
    let totalAmount = Number(order.totalAmount);

    if (input.items && input.items.length > 0) {
      const recalculated = await this.buildOrderItems({
        companyId: order.companyId,
        items: input.items,
        durationDays,
        allowAutoCreate: true,
      });

      subtotal = recalculated.subtotal;

      await prisma.rentalOrderItem.deleteMany({
        where: { rentalOrderId: order.id },
      });

      await prisma.rentalOrderItem.createMany({
        data: recalculated.orderItems.map((item) => ({
          rentalOrderId: order.id,
          rentalItemId: item.rentalItemId,
          rentalBundleId: item.rentalBundleId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          pricingTier: item.pricingTier,
        })),
      });
    } else if (input.rentalStartDate || input.rentalEndDate) {
      const existingItems = await prisma.rentalOrderItem.findMany({
        where: { rentalOrderId: order.id },
      });

      subtotal = 0;
      for (const item of existingItems) {
        const newSubtotal =
          Number(item.unitPrice) * durationDays * item.quantity;
        subtotal += newSubtotal;
        await prisma.rentalOrderItem.update({
          where: { id: item.id },
          data: { subtotal: newSubtotal },
        });
      }
    }

    const discountAmount =
      input.discountAmount ?? Number(order.discountAmount || 0);
    const deliveryFee =
      input.deliveryFee ?? Number(order.deliveryFee || 0);
    const finalSubtotal = subtotal - discountAmount;
    totalAmount = finalSubtotal + deliveryFee;

    const updated = await prisma.rentalOrder.update({
      where: { id: order.id },
      data: this.buildOrderUpdateData(
        input,
        subtotal,
        totalAmount,
        nextPartnerId !== order.partnerId ? nextPartnerId : undefined
      ),
      include: {
        partner: { select: { name: true, phone: true } },
        items: true,
      },
    });

    return updated;
  }

  async deleteOrder(id: string, expectedCompanyId?: string) {
    const order = await prisma.rentalOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    if (
      expectedCompanyId &&
      order.companyId !== expectedCompanyId
    ) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    if (order.status !== RentalOrderStatus.DRAFT) {
      throw new DomainError(
        'Cannot delete order that is not DRAFT',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    await prisma.rentalOrderItem.deleteMany({
      where: { rentalOrderId: id },
    });

    await prisma.rentalOrder.delete({
      where: { id },
    });

    return { success: true };
  }

  private getDurationDays(startDate: Date, endDate: Date): number {
    if (endDate <= startDate) {
      throw new DomainError(
        'Rental end date must be after start date',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    return Math.ceil(
      (endDate.getTime() - startDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
  }

  private async updatePartnerFromInput(
    partnerId: string,
    input: UpdatePublicOrderInput
  ) {
    const partnerUpdate = this.buildPartnerUpdateData(input);

    if (Object.keys(partnerUpdate).length === 0) {
      return;
    }

    await prisma.partner.update({
      where: { id: partnerId },
      data: partnerUpdate,
    });
  }

  private buildPartnerUpdateData(input: UpdatePublicOrderInput) {
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

  private async resolvePartnerForOrderUpdate(
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
  ) {
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

  private buildOrderUpdateData(
    input: UpdatePublicOrderInput,
    subtotal: number,
    totalAmount: number,
    partnerId?: string
  ) {
    const orderUpdate: Record<string, unknown> = {
      subtotal,
      totalAmount,
    };

    if (partnerId !== undefined) {
      orderUpdate.partnerId = partnerId;
    }

    if (input.rentalStartDate !== undefined) {
      orderUpdate.rentalStartDate = input.rentalStartDate;
    }
    if (input.rentalEndDate !== undefined) {
      orderUpdate.rentalEndDate = input.rentalEndDate;
      orderUpdate.dueDateTime = input.rentalEndDate;
    }
    if (input.notes !== undefined) {
      orderUpdate.notes = input.notes;
    }
    if (input.deliveryFee !== undefined) {
      orderUpdate.deliveryFee = input.deliveryFee;
    }
    if (input.deliveryAddress !== undefined) {
      orderUpdate.deliveryAddress = input.deliveryAddress;
    }
    if (input.street !== undefined) {
      orderUpdate.street = input.street;
    }
    if (input.kelurahan !== undefined) {
      orderUpdate.kelurahan = input.kelurahan;
    }
    if (input.kecamatan !== undefined) {
      orderUpdate.kecamatan = input.kecamatan;
    }
    if (input.kota !== undefined) {
      orderUpdate.kota = input.kota;
    }
    if (input.provinsi !== undefined) {
      orderUpdate.provinsi = input.provinsi;
    }
    if (input.zip !== undefined) {
      orderUpdate.zip = input.zip;
    }
    if (input.latitude !== undefined) {
      orderUpdate.latitude = input.latitude;
    }
    if (input.longitude !== undefined) {
      orderUpdate.longitude = input.longitude;
    }
    if (input.paymentMethod !== undefined) {
      orderUpdate.paymentMethod = input.paymentMethod;
    }
    if (input.discountAmount !== undefined) {
      orderUpdate.discountAmount = input.discountAmount;
    }
    if (input.discountLabel !== undefined) {
      orderUpdate.discountLabel = input.discountLabel;
    }

    return orderUpdate;
  }

  private async buildOrderItems(params: {
    companyId: string;
    items: ExternalOrderItemInput[];
    durationDays: number;
    allowAutoCreate: boolean;
  }): Promise<{
    subtotal: number;
    orderItems: ResolvedOrderItem[];
  }> {
    let subtotal = 0;
    const orderItems: ResolvedOrderItem[] = [];

    for (const item of params.items) {
      if (item.rentalBundleId) {
        const bundle = await this.resolveBundle(
          params.companyId,
          item,
          params.allowAutoCreate
        );
        const itemTotal =
          Number(bundle.dailyRate) *
          params.durationDays *
          item.quantity;

        subtotal += itemTotal;
        orderItems.push({
          rentalBundleId: bundle.id,
          quantity: item.quantity,
          unitPrice: bundle.dailyRate,
          subtotal: itemTotal,
          pricingTier: 'DAILY',
        });
        continue;
      }

      if (item.rentalItemId) {
        const rentalItem = await this.resolveRentalItem(
          params.companyId,
          item,
          params.allowAutoCreate
        );
        const itemTotal =
          Number(rentalItem.dailyRate) *
          params.durationDays *
          item.quantity;

        subtotal += itemTotal;
        orderItems.push({
          rentalItemId: rentalItem.id,
          quantity: item.quantity,
          unitPrice: rentalItem.dailyRate,
          subtotal: itemTotal,
          pricingTier: 'DAILY',
        });
        continue;
      }

      throw new DomainError(
        'Either rentalItemId or rentalBundleId is required',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    return { subtotal, orderItems };
  }

  private async resolveBundle(
    companyId: string,
    item: ExternalOrderItemInput,
    allowAutoCreate: boolean
  ): Promise<RateBearingRecord> {
    let bundle = await prisma.rentalBundle.findFirst({
      where: {
        companyId,
        OR: [
          { id: item.rentalBundleId },
          { externalId: item.rentalBundleId },
        ],
      },
      select: {
        id: true,
        dailyRate: true,
      },
    });

    if (
      !bundle &&
      allowAutoCreate &&
      item.name &&
      item.pricePerDay
    ) {
      bundle = await this.createBundleWithComponents(companyId, item);
    }

    if (!bundle) {
      throw new DomainError(
        `Bundle not found: ${item.rentalBundleId}. Provide name, pricePerDay, and components for auto-creation.`,
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    return bundle;
  }

  private async createBundleWithComponents(
    companyId: string,
    item: ExternalOrderItemInput
  ): Promise<RateBearingRecord> {
    if (!item.rentalBundleId || !item.name || !item.pricePerDay) {
      throw new DomainError(
        'Bundle metadata is incomplete for auto-creation',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    const bundleExternalId = item.rentalBundleId;
    const bundleName = item.name;
    const bundlePricePerDay = item.pricePerDay;

    return prisma.$transaction(async (tx) => {
      const newBundle = await tx.rentalBundle.create({
        data: {
          companyId,
          externalId: bundleExternalId,
          name: bundleName,
          dailyRate: bundlePricePerDay,
          weeklyRate: bundlePricePerDay * 6,
          monthlyRate: bundlePricePerDay * 25,
          isActive: true,
        },
        select: {
          id: true,
          dailyRate: true,
        },
      });

      for (const component of item.components || []) {
        const { quantity, label } = this.parseComponentLabel(component);
        const rentalItem = await this.findOrCreateComponentRentalItem(
          tx,
          companyId,
          label
        );

        await tx.rentalBundleComponent.create({
          data: {
            bundleId: newBundle.id,
            rentalItemId: rentalItem.id,
            quantity,
            componentLabel: label,
          },
        });
      }

      return newBundle;
    });
  }

  private async resolveRentalItem(
    companyId: string,
    item: ExternalOrderItemInput,
    allowAutoCreate: boolean
  ): Promise<RateBearingRecord> {
    let rentalItem = await prisma.rentalItem.findFirst({
      where: {
        companyId,
        id: item.rentalItemId,
      },
      select: {
        id: true,
        dailyRate: true,
      },
    });

    if (!rentalItem && item.rentalItemId) {
      rentalItem = await prisma.rentalItem.findFirst({
        where: {
          companyId,
          product: {
            name: {
              equals: item.rentalItemId,
              mode: 'insensitive',
            },
          },
        },
        select: {
          id: true,
          dailyRate: true,
        },
      });
    }

    if (!rentalItem && item.components?.[0]) {
      const componentSku = this.toExternalSku(item.components[0]);
      const freshLookup = await prisma.rentalItem.findFirst({
        where: {
          companyId,
          product: { sku: componentSku },
        },
        select: {
          id: true,
          dailyRate: true,
        },
      });

      if (freshLookup) {
        rentalItem = freshLookup;

        if (
          item.pricePerDay &&
          item.pricePerDay > Number(freshLookup.dailyRate)
        ) {
          await prisma.rentalItem.update({
            where: { id: freshLookup.id },
            data: {
              dailyRate: item.pricePerDay,
              weeklyRate: item.pricePerDay * 6,
              monthlyRate: item.pricePerDay * 25,
            },
          });

          rentalItem = {
            ...freshLookup,
            dailyRate: new Decimal(item.pricePerDay),
          };
        }
      }
    }

    if (
      !rentalItem &&
      allowAutoCreate &&
      item.name &&
      item.pricePerDay
    ) {
      rentalItem = await this.findOrCreateRentalItem(companyId, item);
    }

    if (!rentalItem) {
      throw new DomainError(
        `Rental item not found for: ${item.rentalItemId}. Provide name and pricePerDay for auto-creation.`,
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    return rentalItem;
  }

  private async findOrCreateRentalItem(
    companyId: string,
    item: ExternalOrderItemInput
  ): Promise<RateBearingRecord> {
    if (!item.rentalItemId || !item.name || !item.pricePerDay) {
      throw new DomainError(
        'Rental item metadata is incomplete for auto-creation',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    const componentName = item.components?.[0];
    const productName = componentName
      ? this.capitalizeLabel(componentName)
      : item.name;
    const productSku = componentName
      ? this.toExternalSku(componentName)
      : this.toExternalSku(item.rentalItemId);

    let product = await prisma.product.findFirst({
      where: {
        companyId,
        sku: productSku,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          companyId,
          sku: productSku,
          name: productName,
          price: 0,
        },
        select: {
          id: true,
        },
      });
    }

    const existingRentalItem = await prisma.rentalItem.findFirst({
      where: {
        companyId,
        productId: product.id,
      },
      select: {
        id: true,
        dailyRate: true,
      },
    });

    if (existingRentalItem) {
      if (item.pricePerDay > Number(existingRentalItem.dailyRate)) {
        await prisma.rentalItem.update({
          where: { id: existingRentalItem.id },
          data: {
            dailyRate: item.pricePerDay,
            weeklyRate: item.pricePerDay * 6,
            monthlyRate: item.pricePerDay * 25,
          },
        });

        return {
          ...existingRentalItem,
          dailyRate: new Decimal(item.pricePerDay),
        };
      }

      return existingRentalItem;
    }

    return prisma.rentalItem.create({
      data: {
        companyId,
        productId: product.id,
        dailyRate: item.pricePerDay,
        weeklyRate: item.pricePerDay * 6,
        monthlyRate: item.pricePerDay * 25,
        depositPolicyType: 'PERCENTAGE',
        depositPercentage: 0,
        isActive: true,
      },
      select: {
        id: true,
        dailyRate: true,
      },
    });
  }

  private async findOrCreateComponentRentalItem(
    tx: Prisma.TransactionClient,
    companyId: string,
    label: string
  ): Promise<{ id: string }> {
    const existing = await tx.rentalItem.findFirst({
      where: {
        companyId,
        product: {
          name: {
            contains: label,
            mode: 'insensitive',
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return existing;
    }

    const product = await tx.product.create({
      data: {
        companyId,
        sku: this.toExternalSku(label),
        name: this.capitalizeLabel(label),
        price: 0,
      },
      select: {
        id: true,
      },
    });

    return tx.rentalItem.create({
      data: {
        companyId,
        productId: product.id,
        dailyRate: 5000,
        weeklyRate: 30000,
        monthlyRate: 125000,
        depositPolicyType: 'PERCENTAGE',
        depositPercentage: 0,
        isActive: true,
      },
      select: {
        id: true,
      },
    });
  }

  private parseComponentLabel(componentLabel: string) {
    const quantityMatch = componentLabel.match(/^(\d+)\s+(.+)$/);

    return {
      quantity: quantityMatch
        ? parseInt(quantityMatch[1], 10)
        : 1,
      label: quantityMatch ? quantityMatch[2] : componentLabel,
    };
  }

  private toExternalSku(value: string) {
    return `SL-${value.toLowerCase().replace(/\s+/g, '-')}`;
  }

  private normalizePhone(value: string) {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      return `62${digits.slice(1)}`;
    }

    return digits;
  }

  private capitalizeLabel(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
