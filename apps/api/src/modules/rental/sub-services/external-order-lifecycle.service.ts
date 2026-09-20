import {
  prisma,
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
  Prisma,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import { DocumentNumberService } from '../../common/services/document-number.service.js';
import { ExternalOrderSecurityService } from './external-order-security.service.js';
import { ExternalOrderPartnerService } from './external-order-partner.service.js';
import { ExternalOrderCatalogService } from './external-order-catalog.service.js';
import { ExternalOrderNotificationService } from './external-order-notification.service.js';
import {
  RENTAL_ORDER_INCLUDE,
  type CreatePublicOrderInput,
  type UpdatePublicOrderInput,
} from './external-order.types.js';

export class ExternalOrderLifecycleService {
  constructor(
    private readonly securityService: ExternalOrderSecurityService = new ExternalOrderSecurityService(),
    private readonly partnerService: ExternalOrderPartnerService = new ExternalOrderPartnerService(),
    private readonly catalogService: ExternalOrderCatalogService = new ExternalOrderCatalogService(),
    private readonly notificationService: ExternalOrderNotificationService = new ExternalOrderNotificationService(),
    private readonly documentNumberService: DocumentNumberService = new DocumentNumberService()
  ) {}

  async getById(companyId: string, id: string) {
    const order = await prisma.rentalOrder.findFirst({
      where: { id, companyId },
      include: RENTAL_ORDER_INCLUDE,
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
      include: RENTAL_ORDER_INCLUDE,
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

    const { subtotal, orderItems } = await this.catalogService.buildOrderItems({
      companyId: input.companyId,
      items: input.items,
      durationDays,
      allowAutoCreate: true,
    });

    const discountAmount = this.catalogService.toMoney(input.discountAmount || 0);
    const deliveryFee = this.catalogService.toMoney(input.deliveryFee || 0);
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
        publicTokenExpiresAt: this.securityService.publicTokenExpiry(),
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

    void this.notificationService.notifyRentalEvent(
      input.companyId,
      'rental.order.created',
      {
        order,
      }
    );

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

    const nextPartnerId = await this.partnerService.resolvePartnerForOrderUpdate(
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
      const recalculated = await this.catalogService.buildOrderItems({
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
        const newSubtotal = this.catalogService.toMoney(
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

    const discountAmount = this.catalogService.toMoney(
      input.discountAmount ?? order.discountAmount ?? 0
    );
    const deliveryFee = this.catalogService.toMoney(
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

    void this.notificationService.notifyRentalEvent(
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

    void this.notificationService.notifyRentalEvent(
      cancelled.companyId,
      'rental.order.cancelled',
      { order: cancelled }
    );

    return cancelled;
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

  getDurationDays(startDate: Date, endDate: Date): number {
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

  buildCreatedBy(input: CreatePublicOrderInput): string {
    if (input.createdByApiKeyId) {
      return `api-key:${input.createdByApiKeyId}`;
    }

    return `api:${input.externalSource || 'external'}`;
  }

  buildPolicySnapshot(
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

  toInputJsonValue(
    value: Record<string, unknown>
  ): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  buildOrderUpdateData(
    input: UpdatePublicOrderInput,
    subtotal: Prisma.Decimal | Decimal | number,
    totalAmount: Prisma.Decimal | Decimal | number,
    partnerId?: string
  ): Record<string, unknown> {
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
}
