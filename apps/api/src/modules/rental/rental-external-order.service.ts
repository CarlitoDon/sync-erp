import {
  prisma,
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
  Prisma,
  PartnerType,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { DocumentNumberService } from '../common/services/document-number.service';
import { webhookService } from '../../services/webhook.service';
import { Decimal } from 'decimal.js';
import type {
  RentalIntegrationClaimPaymentInput,
  RentalIntegrationConfirmPaymentInput,
  RentalIntegrationCustomerInput,
  RentalIntegrationRejectPaymentInput,
} from './rental-integration.schemas';

export interface OrderItemComponent {
  quantity: number;
  label: string;
}

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
    lineTotal?: number;
    category?: 'package' | 'mattress' | 'accessory';
    components?: string[] | OrderItemComponent[];
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
  externalId?: string;
  externalSource?: string;
  metadata?: Record<string, unknown>;
  createdByApiKeyId?: string;
    integrationId?: string;
  createdBy?: string;
  skuPrefix?: string;
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
    lineTotal?: number;
    category?: 'package' | 'mattress' | 'accessory';
    components?: string[] | OrderItemComponent[];
  }[];
}

type ExternalOrderItemInput = CreatePublicOrderInput['items'][number];

type ResolvedOrderItem = {
  rentalItemId?: string;
  rentalBundleId?: string;
  quantity: number;
  unitPrice: Prisma.Decimal | number;
  subtotal: Prisma.Decimal | number;
  pricingTier: 'DAILY' | 'CUSTOM';
};

type RateBearingRecord = {
  id: string;
  dailyRate: Prisma.Decimal;
};

export class RentalExternalOrderService {
  private readonly documentNumberService =
    new DocumentNumberService();

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

  async getByToken(token: string) {
    const order = await prisma.rentalOrder.findFirst({
      where: {
        publicToken: token,
        publicTokenExpiresAt: { gt: new Date() },
      },
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

  async getById(companyId: string, id: string) {
    const order = await prisma.rentalOrder.findFirst({
      where: { id, companyId },
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

  async getByOrderNumber(companyId: string, orderNumber: string) {
    const order = await prisma.rentalOrder.findFirst({
      where: { orderNumber, companyId },
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

    const discountAmount = this.toMoney(input.discountAmount || 0);
    const deliveryFee = this.toMoney(input.deliveryFee || 0);
    const finalSubtotal = subtotal.minus(discountAmount);
    const totalAmount = finalSubtotal.plus(deliveryFee);
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
        publicTokenExpiresAt: this.publicTokenExpiry(),
        status: RentalOrderStatus.DRAFT,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        subtotal,
        depositAmount: 0,
        totalAmount,
        policySnapshot: this.buildPolicySnapshot(input),
        notes: input.notes,
        createdBy: this.buildCreatedBy(input),
        deliveryFee,
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
        discountAmount,
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

    void this.notifyRentalEvent(input.companyId, 'rental.order.created', {
      order,
    });

    return order;
  }

  async updateOrder(
    input: UpdatePublicOrderInput,
    expectedCompanyId?: string
  ) {
    const order = await prisma.rentalOrder.findFirst({
      where: { publicToken: input.token },
      include: {
        partner: true,
        items: true,
        _count: { select: { extensions: true } },
      },
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
    if (
      order._count.extensions > 0 &&
      (input.items?.length ||
        input.rentalStartDate !== undefined ||
        input.rentalEndDate !== undefined)
    ) {
      throw new DomainError(
        'Cannot replace items or dates on an order that already has extensions',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    let subtotal = new Decimal(order.subtotal);
    let totalAmount = new Decimal(order.totalAmount);

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

      subtotal = new Decimal(0);
      for (const item of existingItems) {
        const newSubtotal = this.toMoney(
          new Decimal(item.unitPrice)
            .times(durationDays)
            .times(item.quantity)
        );
        subtotal = subtotal.plus(newSubtotal);
        await prisma.rentalOrderItem.update({
          where: { id: item.id },
          data: { subtotal: newSubtotal },
        });
      }
    }

    const discountAmount = this.toMoney(
      input.discountAmount ?? order.discountAmount ?? 0
    );
    const deliveryFee = this.toMoney(
      input.deliveryFee ?? order.deliveryFee ?? 0
    );
    const finalSubtotal = subtotal.minus(discountAmount);
    totalAmount = finalSubtotal.plus(deliveryFee);

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

    void this.notifyRentalEvent(
      updated.companyId,
      'rental.order.updated',
      { order: updated }
    );

    return updated;
  }

  async cancelOrder(input: {
    id: string;
    companyId: string;
    reason?: string;
  }) {
    const order = await prisma.rentalOrder.findFirst({
      where: {
        id: input.id,
        companyId: input.companyId,
      },
    });

    if (!order) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    if (order.status === RentalOrderStatus.COMPLETED) {
      throw new DomainError(
        'Completed orders cannot be cancelled by integration API',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    const cancelled = await prisma.rentalOrder.update({
      where: { id: order.id },
      data: {
        status: RentalOrderStatus.CANCELLED,
        cancelledAt: new Date(),
        notes: input.reason
          ? [order.notes, `Cancellation reason: ${input.reason}`]
              .filter(Boolean)
              .join('\n')
          : order.notes,
      },
      include: {
        partner: { select: { name: true, phone: true } },
        items: true,
      },
    });

    void this.notifyRentalEvent(
      cancelled.companyId,
      'rental.order.cancelled',
      { order: cancelled }
    );

    return cancelled;
  }

  async claimPayment(
    companyId: string,
    input: RentalIntegrationClaimPaymentInput
  ) {
    const order = await prisma.rentalOrder.findFirst({
      where: {
        publicToken: input.token,
        companyId,
      },
      select: {
        id: true,
        orderNumber: true,
        rentalPaymentStatus: true,
        status: true,
        companyId: true,
        totalAmount: true,
      },
    });

    if (!order) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    if (order.rentalPaymentStatus !== RentalPaymentStatus.PENDING) {
      throw new DomainError(
        `Cannot claim payment. Current status: ${order.rentalPaymentStatus}`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    const updatedOrder = await prisma.rentalOrder.update({
      where: { id: order.id },
      data: {
        rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
        paymentClaimedAt: new Date(),
        paymentMethod: input.paymentMethod,
        paymentReference: input.reference || null,
      },
      select: {
        orderNumber: true,
        rentalPaymentStatus: true,
        paymentClaimedAt: true,
        paymentMethod: true,
        paymentReference: true,
      },
    });

    void this.notifyPaymentEvent(companyId, 'rental.payment.claimed', {
      id: order.id,
      orderNumber: order.orderNumber,
      rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
      totalAmount: order.totalAmount,
      paymentMethod: input.paymentMethod,
      paymentReference: input.reference || null,
    });

    return {
      success: true,
      orderNumber: updatedOrder.orderNumber,
      rentalPaymentStatus: updatedOrder.rentalPaymentStatus,
      paymentClaimedAt: updatedOrder.paymentClaimedAt,
    };
  }

  async confirmPaymentByOrderNumber(
    companyId: string,
    input: RentalIntegrationConfirmPaymentInput
  ) {
    const order = await prisma.rentalOrder.findFirst({
      where: {
        companyId,
        orderNumber: input.orderNumber,
      },
    });

    if (!order) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    if (order.rentalPaymentStatus === RentalPaymentStatus.CONFIRMED) {
      return { success: true, status: 'ALREADY_CONFIRMED' };
    }

    if (
      order.orderSource === OrderSource.WEBSITE &&
      input.amount === undefined
    ) {
      throw new DomainError(
        'Payment amount is required for website orders',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    if (
      input.amount !== undefined &&
      Math.round(input.amount) !== Math.round(Number(order.totalAmount))
    ) {
      throw new DomainError(
        'Payment amount does not match the current order total',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    const updatedOrder = await prisma.rentalOrder.update({
      where: { id: order.id },
      data: {
        rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
        paymentConfirmedAt: new Date(),
        paymentMethod: input.paymentMethod,
        paymentReference: input.transactionId,
        ...(order.orderSource === OrderSource.WEBSITE &&
        order.status === RentalOrderStatus.DRAFT
          ? {
              status: RentalOrderStatus.CONFIRMED,
              confirmedAt: new Date(),
              publicTokenExpiresAt: new Date(),
            }
          : {}),
      },
    });

    void this.notifyPaymentEvent(companyId, 'rental.payment.confirmed', {
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      rentalPaymentStatus: updatedOrder.rentalPaymentStatus,
      totalAmount: updatedOrder.totalAmount,
      paymentMethod: updatedOrder.paymentMethod,
      paymentReference: updatedOrder.paymentReference,
    });

    return {
      success: true,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
    };
  }

  async rejectPaymentByOrderNumber(
    companyId: string,
    input: RentalIntegrationRejectPaymentInput
  ) {
    const order = await prisma.rentalOrder.findFirst({
      where: {
        companyId,
        orderNumber: input.orderNumber,
      },
    });

    if (!order) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    if (order.rentalPaymentStatus === RentalPaymentStatus.CONFIRMED) {
      return {
        success: true,
        orderNumber: order.orderNumber,
        status: 'ALREADY_CONFIRMED',
      };
    }

    if (order.rentalPaymentStatus === RentalPaymentStatus.FAILED) {
      return {
        success: true,
        orderNumber: order.orderNumber,
        status: 'ALREADY_FAILED',
      };
    }

    const updatedOrder = await prisma.rentalOrder.update({
      where: { id: order.id },
      data: {
        rentalPaymentStatus: RentalPaymentStatus.FAILED,
        paymentFailedAt: new Date(),
        paymentFailReason: input.failReason,
        paymentMethod: input.paymentMethod || order.paymentMethod,
      },
    });

    void this.notifyPaymentEvent(companyId, 'rental.payment.rejected', {
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      rentalPaymentStatus: updatedOrder.rentalPaymentStatus,
      totalAmount: updatedOrder.totalAmount,
      paymentMethod: updatedOrder.paymentMethod,
      paymentReference: updatedOrder.paymentReference,
      failReason: input.failReason,
    });

    return {
      success: true,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.rentalPaymentStatus,
    };
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

  /**
   * TTL for newly minted public order tokens. The token is a tracking
   * credential for a draft order; once the order moves past DRAFT the
   * terminal cut-off in revokePublicAccessOnTerminal() also revokes it.
   */
  private publicTokenExpiry(): Date {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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

  private buildCreatedBy(input: CreatePublicOrderInput) {
    if (input.createdByApiKeyId) {
      return `api-key:${input.createdByApiKeyId}`;
    }

    return `api:${input.externalSource || 'external'}`;
  }

  private buildPolicySnapshot(
    input: CreatePublicOrderInput
  ): Prisma.InputJsonObject {
    const integration: Record<string, Prisma.InputJsonValue> = {};

    if (input.externalId !== undefined) {
      integration.externalId = input.externalId;
    }
    if (input.externalSource !== undefined) {
      integration.externalSource = input.externalSource;
    }
    if (input.createdByApiKeyId !== undefined) {
      integration.createdByApiKeyId = input.createdByApiKeyId;
    }
    if (input.metadata !== undefined) {
      integration.metadata = this.toInputJsonValue(input.metadata);
    }

    return {
      integration: integration as Prisma.InputJsonObject,
    };
  }

  private toInputJsonValue(
    value: Record<string, unknown>
  ): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private async notifyRentalEvent(
    companyId: string,
    event:
      | 'rental.order.created'
      | 'rental.order.updated'
      | 'rental.order.cancelled',
    payload: Record<string, unknown>
  ) {
    try {
      await webhookService.notifyTenant(companyId, event, payload);
    } catch (error) {
      console.error('[RentalIntegration] Webhook enqueue failed:', error);
    }
  }

  private async notifyPaymentEvent(
    companyId: string,
    event:
      | 'rental.payment.claimed'
      | 'rental.payment.confirmed'
      | 'rental.payment.rejected',
    payload: Record<string, unknown>
  ) {
    try {
      await webhookService.notifyTenant(companyId, event, payload);
    } catch (error) {
      console.error('[RentalIntegration] Payment webhook enqueue failed:', error);
    }
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
    subtotal: Prisma.Decimal | Decimal | number,
    totalAmount: Prisma.Decimal | Decimal | number,
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
    subtotal: Decimal;
    orderItems: ResolvedOrderItem[];
  }> {
    let subtotal = new Decimal(0);
    const orderItems: ResolvedOrderItem[] = [];

    for (const item of params.items) {
      if (item.rentalBundleId) {
        const bundle = await this.resolveBundle(
          params.companyId,
          item,
          params.allowAutoCreate
        );
        const dailyRate = this.resolveInvoiceDailyRate(
          item,
          bundle.dailyRate
        );
        const itemTotal = this.resolveInvoiceLineTotal(
          item,
          dailyRate,
          params.durationDays
        );
        const unitPrice = this.resolveInvoiceUnitPrice(
          item,
          dailyRate,
          params.durationDays
        );

        subtotal = subtotal.plus(itemTotal);
        orderItems.push({
          rentalBundleId: bundle.id,
          quantity: item.quantity,
          unitPrice,
          subtotal: itemTotal,
          pricingTier:
            item.pricePerDay !== undefined ||
            item.lineTotal !== undefined
              ? 'CUSTOM'
              : 'DAILY',
        });
        continue;
      }

      if (item.rentalItemId) {
        const rentalItem = await this.resolveRentalItem(
          params.companyId,
          item,
          params.allowAutoCreate
        );
        const dailyRate = this.resolveInvoiceDailyRate(
          item,
          rentalItem.dailyRate
        );
        const itemTotal = this.resolveInvoiceLineTotal(
          item,
          dailyRate,
          params.durationDays
        );
        const unitPrice = this.resolveInvoiceUnitPrice(
          item,
          dailyRate,
          params.durationDays
        );

        subtotal = subtotal.plus(itemTotal);
        orderItems.push({
          rentalItemId: rentalItem.id,
          quantity: item.quantity,
          unitPrice,
          subtotal: itemTotal,
          pricingTier:
            item.pricePerDay !== undefined ||
            item.lineTotal !== undefined
              ? 'CUSTOM'
              : 'DAILY',
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

  private resolveInvoiceDailyRate(
    item: ExternalOrderItemInput,
    fallbackDailyRate: Prisma.Decimal
  ): Decimal {
    if (item.pricePerDay === undefined) {
      return new Decimal(fallbackDailyRate);
    }

    if (item.pricePerDay <= 0) {
      throw new DomainError(
        'pricePerDay must be positive when provided',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    return new Decimal(item.pricePerDay);
  }

  private resolveInvoiceLineTotal(
    item: ExternalOrderItemInput,
    dailyRate: Decimal,
    durationDays: number
  ): Decimal {
    if (item.lineTotal !== undefined) {
      return this.toMoney(item.lineTotal);
    }

    return this.toMoney(
      dailyRate.times(durationDays).times(item.quantity)
    );
  }

  private resolveInvoiceUnitPrice(
    item: ExternalOrderItemInput,
    dailyRate: Decimal,
    durationDays: number
  ): Decimal {
    if (item.pricePerDay !== undefined) {
      return this.toMoney(item.pricePerDay);
    }

    if (item.lineTotal !== undefined) {
      return this.toMoney(
        new Decimal(item.lineTotal)
          .div(durationDays)
          .div(item.quantity)
      );
    }

    return this.toMoney(dailyRate);
  }

  private toMoney(value: Prisma.Decimal | Decimal | number): Decimal {
    return new Decimal(value).toDecimalPlaces(2);
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
        const normalized = this.normalizeComponentItem(component);
        const { quantity, label } = normalized;
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
      const firstComponent = this.getComponentLabel(item.components[0]);
      const componentSku = this.toExternalSku(firstComponent);
      const freshLookup = await prisma.rentalItem.findFirst({
        where: {
          companyId,
          OR: [
            { product: { sku: componentSku } },
            {
              product: {
                name: {
                  contains: firstComponent,
                  mode: 'insensitive',
                },
              },
            },
          ],
        },
        select: {
          id: true,
          dailyRate: true,
        },
      });

      if (freshLookup) {
        rentalItem = freshLookup;
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
    const label = componentName ? this.getComponentLabel(componentName) : null;
    const productName = label
      ? this.capitalizeLabel(label)
      : item.name;
    const productSku = label
      ? this.toExternalSku(label)
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

  private getComponentLabel(component: string | OrderItemComponent): string {
    return typeof component === 'string' ? component : component.label;
  }

  private normalizeComponentItem(component: string | OrderItemComponent): { quantity: number; label: string } {
    if (typeof component === 'string') {
      return this.parseComponentLabel(component);
    }
    return component;
  }

  private toExternalSku(value: string) {
    return `EXT-${value.toLowerCase().replace(/\s+/g, '-')}`;
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
