/**
 * Rental Order Lifecycle Service
 *
 * Handles creation, cancellation, extension, and retrieval of rental orders.
 */

import { Prisma, prisma } from '@sync-erp/database';
import {
  RentalOrder,
  RentalOrderStatus,
  AuditLogAction,
  EntityType,
<<<<<<< HEAD
  OrderSource,
=======
>>>>>>> origin/dev
} from '@sync-erp/database';
import { RentalRepository } from './rental.repository';
import { DocumentNumberService } from '../common/services/document-number.service';
import { recordAudit } from '../common/audit/audit-log.service';
import { JournalService } from '../accounting/services/journal.service';
import { RentalWebhookService } from './rental-webhook.service';
import {
  DomainError,
  DomainErrorCodes,
  type CreateRentalOrderInput,
<<<<<<< HEAD
  type ExtendRentalOrderInput,
=======
>>>>>>> origin/dev
  type PrismaRentalOrderWithRelations,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import { calculateOptimalTier } from './rules/pricing';
import { mapToRentalOrder } from './rental.mapper';

export class RentalOrderLifecycleService {
  constructor(
    private readonly repository: RentalRepository = new RentalRepository(),
    private readonly documentNumberService: DocumentNumberService = new DocumentNumberService(),
<<<<<<< HEAD
    _journalService: JournalService = new JournalService(),
=======
    private readonly journalService: JournalService = new JournalService(),
>>>>>>> origin/dev
    private readonly webhookService: RentalWebhookService = new RentalWebhookService()
  ) {}

  async listOrders(
    companyId: string,
    filters?: {
      status?: RentalOrderStatus;
      partnerId?: string;
      dateRange?: { start: Date; end: Date };
      take?: number;
      cursor?: string;
    }
  ): Promise<{
    items: PrismaRentalOrderWithRelations[];
    nextCursor: string | null;
  }> {
    const take = filters?.take ?? 50;
    const rawItems = await this.repository.listRentalOrders(companyId, {
      ...filters,
      take: take + 1,
      cursor: filters?.cursor,
    });
    const items = rawItems.map(mapToRentalOrder);

    const hasMore = items.length > take;
    const resultItems = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore
      ? resultItems[resultItems.length - 1].id
      : null;

    return {
      items: resultItems,
      nextCursor,
    };
  }

  async getOrderById(
    companyId: string,
    id: string
  ): Promise<PrismaRentalOrderWithRelations | null> {
    const order = await this.repository.findOrderById(id);
    if (order && order.companyId !== companyId) {
      return null;
    }
    return order;
  }

  async createOrder(
    companyId: string,
    data: CreateRentalOrderInput,
    userId: string
  ): Promise<PrismaRentalOrderWithRelations> {
    // Validate dates
    if (data.rentalEndDate <= data.rentalStartDate) {
      throw new DomainError(
        'End date must be after start date',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    // List IDs
    const rentalItemIds = data.items
      .map((i) => i.rentalItemId)
      .filter((id): id is string => !!id);
    const rentalBundleIds = data.items
      .map((i) => i.rentalBundleId)
      .filter((id): id is string => !!id);

    // Fetch items and bundles
    const [items, bundles] = await Promise.all([
      prisma.rentalItem.findMany({
        where: { id: { in: rentalItemIds }, companyId },
      }),
      prisma.rentalBundle.findMany({
        where: { id: { in: rentalBundleIds }, companyId },
      }),
    ]);

    // Validate all found
    if (items.length !== new Set(rentalItemIds).size) {
      throw new DomainError(
        'Some rental items not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }
    if (bundles.length !== new Set(rentalBundleIds).size) {
      throw new DomainError(
        'Some rental bundles not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    // Calculate rental duration
    const rentalDays = Math.ceil(
      (data.rentalEndDate.getTime() -
        data.rentalStartDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Calculate subtotal using pricing rules
    let subtotal = new Decimal(0);
    const orderItems: Prisma.RentalOrderItemCreateWithoutRentalOrderInput[] =
      [];

    for (const orderItem of data.items) {
      let dailyRate = 0;
      let weeklyRate = 0;
      let monthlyRate = 0;
      let itemId: string | undefined;
      let bundleId: string | undefined;

      if (orderItem.rentalItemId) {
        const item = items.find(
          (i) => i.id === orderItem.rentalItemId
        )!;
        dailyRate = item.dailyRate.toNumber();
        weeklyRate = item.weeklyRate.toNumber();
        monthlyRate = item.monthlyRate.toNumber();
        itemId = item.id;
      } else if (orderItem.rentalBundleId) {
        const bundle = bundles.find(
          (b) => b.id === orderItem.rentalBundleId
        )!;
        dailyRate = bundle.dailyRate.toNumber();
        weeklyRate = bundle.weeklyRate
          ? bundle.weeklyRate.toNumber()
          : dailyRate * 7;
        monthlyRate = bundle.monthlyRate
          ? bundle.monthlyRate.toNumber()
          : dailyRate * 30;
        bundleId = bundle.id;
      } else {
        continue;
      }

<<<<<<< HEAD
      const tier =
        orderItem.pricePerDay !== undefined ||
        orderItem.lineTotal !== undefined
        ? {
            ratePerDay:
              orderItem.pricePerDay !== undefined
                ? new Decimal(orderItem.pricePerDay).toDecimalPlaces(2)
                : new Decimal(orderItem.lineTotal ?? 0)
                    .div(rentalDays)
                    .div(orderItem.quantity)
                    .toDecimalPlaces(2),
            totalAmount:
              orderItem.lineTotal !== undefined
                ? new Decimal(orderItem.lineTotal).toDecimalPlaces(2)
                : new Decimal(orderItem.pricePerDay ?? 0)
                    .times(rentalDays)
                    .toDecimalPlaces(2),
            tier: 'CUSTOM' as const,
          }
        : calculateOptimalTier(
            rentalDays,
            dailyRate,
            weeklyRate,
            monthlyRate
          );

      const itemTotal =
        orderItem.lineTotal !== undefined
          ? tier.totalAmount
          : tier.totalAmount
              .times(orderItem.quantity)
              .toDecimalPlaces(2);
=======
      const tier = calculateOptimalTier(
        rentalDays,
        dailyRate,
        weeklyRate,
        monthlyRate
      );

      const itemTotal = tier.totalAmount.times(orderItem.quantity);
>>>>>>> origin/dev
      subtotal = subtotal.plus(itemTotal);

      orderItems.push({
        rentalItem: itemId ? { connect: { id: itemId } } : undefined,
        rentalBundle: bundleId
          ? { connect: { id: bundleId } }
          : undefined,
        quantity: orderItem.quantity,
        unitPrice: tier.ratePerDay,
        subtotal: itemTotal,
        pricingTier: tier.tier,
      });
    }

<<<<<<< HEAD
    const discountAmount = new Decimal(
      data.discountAmount ?? 0
    ).toDecimalPlaces(2);
    if (discountAmount.greaterThan(subtotal)) {
      throw new DomainError(
        'Discount cannot exceed rental subtotal',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
    const deliveryFee = new Decimal(
      data.deliveryFee ?? 0
    ).toDecimalPlaces(2);
    const totalAmount = subtotal
      .minus(discountAmount)
      .plus(deliveryFee)
      .toDecimalPlaces(2);

=======
>>>>>>> origin/dev
    // Resolve dueDateTime default
    const dueDateTime = data.dueDateTime ?? data.rentalEndDate;

    // Snapshot current policy
    const policy = await this.repository.getCurrentPolicy(companyId);
    const policySnapshot = policy
      ? {
          gracePeriodHours: policy.gracePeriodHours,
          lateFeeDailyRate: policy.lateFeeDailyRate.toNumber(),
          cleaningFee: policy.cleaningFee.toNumber(),
          pickupGracePeriodHours: policy.pickupGracePeriodHours,
        }
      : null;

    // Generate order number
    const orderNumber = await this.documentNumberService.generate(
      companyId,
      'RNT'
    );

    // Execute
    const order = await this.repository.createRentalOrder(
      {
        company: { connect: { id: companyId } },
        partner: { connect: { id: data.partnerId } },
        orderNumber,
        rentalStartDate: data.rentalStartDate,
        rentalEndDate: data.rentalEndDate,
        dueDateTime,
        status: RentalOrderStatus.DRAFT,
        subtotal,
        depositAmount: new Decimal(0),
<<<<<<< HEAD
        totalAmount,
=======
        totalAmount: subtotal,
>>>>>>> origin/dev
        policySnapshot:
          (policySnapshot as Prisma.InputJsonValue) ||
          Prisma.JsonNull,
        notes: data.notes,
        createdBy: userId,
<<<<<<< HEAD
        deliveryFee:
          data.deliveryFee !== undefined ? deliveryFee : undefined,
        deliveryAddress: data.deliveryAddress,
        street: data.street,
        kelurahan: data.kelurahan,
        kecamatan: data.kecamatan,
        kota: data.kota,
        provinsi: data.provinsi,
        zip: data.zip,
        latitude:
          data.latitude !== undefined
            ? new Decimal(data.latitude)
            : undefined,
        longitude:
          data.longitude !== undefined
            ? new Decimal(data.longitude)
            : undefined,
        paymentMethod: data.paymentMethod,
        discountAmount:
          data.discountAmount !== undefined
            ? discountAmount
            : undefined,
        discountLabel: data.discountLabel,
        orderSource: OrderSource.ADMIN,
=======
>>>>>>> origin/dev
        items: {
          create: orderItems,
        },
      },
      undefined
    );

    await recordAudit({
      companyId,
      actorId: userId,
      action: AuditLogAction.RENTAL_ORDER_CREATED,
      entityType: EntityType.RENTAL_ORDER,
      entityId: order.id,
      businessDate: new Date(),
    });

    // Notify webhook
    await this.webhookService.notifyOrderCreated(order);

    // Return full order object with relations (fetched fresh)
    const newOrder = await this.repository.findOrderById(order.id);
    if (!newOrder) {
      throw new DomainError(
        'Created order not found',
        500,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }
    return newOrder;
  }

  async cancelOrder(
    companyId: string,
    orderId: string,
    reason: string,
    userId: string
  ): Promise<RentalOrder> {
    const order = await this.repository.findOrderById(orderId);
    if (!order || order.companyId !== companyId) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    if (
      !(
        [
          RentalOrderStatus.DRAFT,
          RentalOrderStatus.CONFIRMED,
        ] as RentalOrderStatus[]
      ).includes(order.status)
    ) {
      throw new DomainError(
        'Cannot cancel order in current status',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    // Use transaction for consistency
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Release reserved units if any
      const assignments = await tx.rentalOrderUnitAssignment.findMany(
        {
          where: { rentalOrderId: orderId },
        }
      );

      if (assignments.length > 0) {
        await tx.rentalItemUnit.updateMany({
          where: {
            id: { in: assignments.map((a) => a.rentalItemUnitId) },
          },
          data: { status: 'AVAILABLE' }, // Using literal string or enum if imported
        });
      }

      // Handle deposit refund if collected
      if (order.deposit) {
        // Assuming DepositStatus.REFUNDED
        await tx.rentalDeposit.update({
          where: { id: order.deposit.id },
          data: {
            status: 'REFUNDED',
            refundedAt: new Date(),
          },
        });
      }

      const updated = await tx.rentalOrder.update({
        where: { id: orderId },
        data: {
          status: RentalOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          notes: order.notes
            ? `${order.notes}\n[Cancelled: ${reason}]`
            : `[Cancelled: ${reason}]`,
        },
      });

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ORDER_CANCELLED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: order.id,
        businessDate: new Date(),
        payloadSnapshot: { reason },
      });

      return updated;
    });

    // Notify webhook
    await this.webhookService.notifyOrderCancelled(updatedOrder);

    return updatedOrder;
  }

  async extendOrder(
    companyId: string,
<<<<<<< HEAD
    input: ExtendRentalOrderInput,
    userId: string
  ): Promise<PrismaRentalOrderWithRelations> {
    const orderId = await prisma.$transaction(async (tx) => {
      const order = await tx.rentalOrder.findUnique({
        where: { id: input.orderId },
        include: {
          items: { include: { rentalItem: true, rentalBundle: true } },
          extensions: { include: { items: true } },
=======
    input: {
      orderId: string;
      newEndDate: Date;
      additionalDeposit?: number;
      reason?: string;
    },
    userId: string
  ): Promise<RentalOrder> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.rentalOrder.findUnique({
        where: { id: input.orderId },
        include: {
          items: { include: { rentalItem: true } },
          extensions: true,
>>>>>>> origin/dev
        },
      });

      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

<<<<<<< HEAD
      const extendableStatuses: RentalOrderStatus[] = input.allowHistorical
        ? [
            RentalOrderStatus.DRAFT,
            RentalOrderStatus.CONFIRMED,
            RentalOrderStatus.ACTIVE,
            RentalOrderStatus.COMPLETED,
          ]
        : [RentalOrderStatus.CONFIRMED, RentalOrderStatus.ACTIVE];

      if (!extendableStatuses.includes(order.status)) {
        throw new DomainError(
          input.allowHistorical
            ? 'Can only extend DRAFT, CONFIRMED, ACTIVE, or COMPLETED orders'
            : 'Can only extend ACTIVE or CONFIRMED orders',
=======
      if (
        order.status !== RentalOrderStatus.ACTIVE &&
        order.status !== RentalOrderStatus.CONFIRMED
      ) {
        throw new DomainError(
          'Can only extend ACTIVE or CONFIRMED orders',
>>>>>>> origin/dev
          400,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }

<<<<<<< HEAD
      const isItemLevelExtension = !!input.items?.length;
      if (!isItemLevelExtension && input.newEndDate <= order.rentalEndDate) {
=======
      if (input.newEndDate <= order.rentalEndDate) {
>>>>>>> origin/dev
        throw new DomainError(
          'New end date must be after current end date',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }

<<<<<<< HEAD
      const resolveOrderItem = (
        extensionItem: NonNullable<ExtendRentalOrderInput['items']>[number]
      ) => {
        if (extensionItem.rentalOrderItemId) {
          return order.items.find(
            (item) => item.id === extensionItem.rentalOrderItemId
          );
        }

        const matches = order.items.filter((item) => {
          if (extensionItem.rentalItemId) {
            return item.rentalItemId === extensionItem.rentalItemId;
          }
          return item.rentalBundleId === extensionItem.rentalBundleId;
        });

        if (matches.length > 1) {
          throw new DomainError(
            'Multiple order items match extension item; use rentalOrderItemId',
            400,
            DomainErrorCodes.INVALID_INPUT
          );
        }

        return matches[0];
      };

      const selectedItems: NonNullable<ExtendRentalOrderInput['items']> =
        input.items ??
        order.items.map((item) => ({
          rentalOrderItemId: item.id,
          quantity: item.quantity,
        }));

      const quantityByOrderItemId = new Map<string, number>();
      let itemAdditionalAmount =
        input.additionalAmount !== undefined
          ? new Decimal(input.additionalAmount)
          : new Decimal(0);
      const deliveryFee = new Decimal(input.deliveryFee ?? 0);
      let maxAdditionalDays = 0;
      let itemLevelPreviousEndDate: Date | undefined;
      const extensionItems: Prisma.RentalOrderExtensionItemCreateWithoutExtensionInput[] =
        [];

      if (input.additionalAmount === undefined || isItemLevelExtension) {
        itemAdditionalAmount = new Decimal(0);

        for (const selectedItem of selectedItems) {
          const orderItem = resolveOrderItem(selectedItem);
          if (!orderItem) {
            throw new DomainError(
              'Extension item not found on rental order',
              400,
              DomainErrorCodes.INVALID_INPUT
            );
          }

          const quantity = selectedItem.quantity ?? orderItem.quantity;
          const totalSelectedQuantity =
            (quantityByOrderItemId.get(orderItem.id) ?? 0) + quantity;
          if (quantity < 1 || totalSelectedQuantity > orderItem.quantity) {
            throw new DomainError(
              'Extension quantity exceeds original order item quantity',
              400,
              DomainErrorCodes.INVALID_INPUT
            );
          }
          quantityByOrderItemId.set(orderItem.id, totalSelectedQuantity);

          const previousEndDate = isItemLevelExtension
            ? order.extensions
                .flatMap((extension) => extension.items)
                .filter(
                  (extensionItem) =>
                    extensionItem.rentalOrderItemId === orderItem.id
                )
                .reduce(
                  (latest, extensionItem) =>
                    extensionItem.newEndDate > latest
                      ? extensionItem.newEndDate
                      : latest,
                  order.rentalEndDate
                )
            : order.rentalEndDate;

          if (input.newEndDate <= previousEndDate) {
            throw new DomainError(
              'New end date must be after current item end date',
              400,
              DomainErrorCodes.INVALID_INPUT
            );
          }

          const additionalDays = Math.ceil(
            (input.newEndDate.getTime() - previousEndDate.getTime()) /
              (1000 * 60 * 60 * 24)
          );
          maxAdditionalDays = Math.max(maxAdditionalDays, additionalDays);
          itemLevelPreviousEndDate =
            !itemLevelPreviousEndDate ||
            previousEndDate < itemLevelPreviousEndDate
              ? previousEndDate
              : itemLevelPreviousEndDate;

          const decimalQuantity = new Decimal(quantity);
          const selectedUnitPrice =
            selectedItem.unitPrice !== undefined
              ? new Decimal(selectedItem.unitPrice)
              : new Decimal(orderItem.unitPrice?.toString() ?? 0);
          let unitPrice = selectedUnitPrice;
          let lineAmount =
            selectedItem.additionalAmount !== undefined
              ? new Decimal(selectedItem.additionalAmount)
              : new Decimal(0);

          if (selectedItem.additionalAmount === undefined) {
            if (unitPrice.gt(0)) {
              lineAmount = unitPrice
                .times(additionalDays)
                .times(decimalQuantity);
            } else {
              const priceSource =
                orderItem.rentalItem ?? orderItem.rentalBundle;
              if (!priceSource) {
                throw new DomainError(
                  'Extension item has no price source',
                  400,
                  DomainErrorCodes.INVALID_INPUT
                );
              }

              const dailyRate = Number(priceSource.dailyRate);
              const weeklyRate = priceSource.weeklyRate
                ? Number(priceSource.weeklyRate)
                : dailyRate * 7;
              const monthlyRate = priceSource.monthlyRate
                ? Number(priceSource.monthlyRate)
                : dailyRate * 30;
              const tier = calculateOptimalTier(
                additionalDays,
                dailyRate,
                weeklyRate,
                monthlyRate
              );
              unitPrice = tier.ratePerDay;
              lineAmount = tier.totalAmount.times(decimalQuantity);
            }
          } else if (unitPrice.eq(0)) {
            unitPrice = lineAmount.div(additionalDays).div(decimalQuantity);
          }

          itemAdditionalAmount = itemAdditionalAmount.plus(lineAmount);
          extensionItems.push({
            company: { connect: { id: companyId } },
            rentalOrderItem: { connect: { id: orderItem.id } },
            rentalItem: orderItem.rentalItemId
              ? { connect: { id: orderItem.rentalItemId } }
              : undefined,
            rentalBundle: orderItem.rentalBundleId
              ? { connect: { id: orderItem.rentalBundleId } }
              : undefined,
            quantity,
            previousEndDate,
            newEndDate: input.newEndDate,
            additionalDays,
            unitPrice,
            additionalAmount: lineAmount,
            notes: selectedItem.notes,
            createdAt: input.businessDate,
          });
        }
      } else {
        maxAdditionalDays = Math.ceil(
          (input.newEndDate.getTime() - order.rentalEndDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
      }

      const totalAdditionalAmount = itemAdditionalAmount.plus(deliveryFee);
      const extensionNumber = (order.extensions?.length || 0) + 1;
      const extensionReason = input.reason ?? input.notes;
      const shouldUpdateOrderDates =
        input.updateOrderDates ?? !isItemLevelExtension;
      const aggregatePreviousEndDate =
        isItemLevelExtension && itemLevelPreviousEndDate
          ? itemLevelPreviousEndDate
          : order.rentalEndDate;
=======
      const additionalDays = Math.ceil(
        (input.newEndDate.getTime() - order.rentalEndDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      let additionalAmount = new Decimal(0);
      for (const item of order.items) {
        if (!item.rentalItem) continue;

        const tier = calculateOptimalTier(
          additionalDays,
          Number(item.rentalItem.dailyRate),
          Number(item.rentalItem.weeklyRate),
          Number(item.rentalItem.monthlyRate)
        );
        additionalAmount = additionalAmount.plus(
          tier.totalAmount.times(item.quantity)
        );
      }

      const extensionNumber = (order.extensions?.length || 0) + 1;
>>>>>>> origin/dev

      const extension = await tx.rentalOrderExtension.create({
        data: {
          rentalOrderId: order.id,
          companyId,
          extensionNumber,
<<<<<<< HEAD
          previousEndDate: aggregatePreviousEndDate,
          newEndDate: input.newEndDate,
          additionalDays: maxAdditionalDays,
          additionalAmount: totalAdditionalAmount,
          deliveryFee,
          deliveryFeeLabel: input.deliveryFeeLabel,
          additionalDeposit: input.additionalDeposit || 0,
          reason: extensionReason,
          isPaid: input.isPaid ?? false,
          paidAt: input.paidAt,
          paymentId: input.paymentId,
          createdAt: input.businessDate,
          createdBy: userId,
          items: extensionItems.length
            ? { create: extensionItems }
            : undefined,
=======
          previousEndDate: order.rentalEndDate,
          newEndDate: input.newEndDate,
          additionalDays,
          additionalAmount,
          additionalDeposit: input.additionalDeposit || 0,
          reason: input.reason,
          createdBy: userId,
>>>>>>> origin/dev
        },
      });

      const newDueDateTime = new Date(
        input.newEndDate.getTime() + 18 * 60 * 60 * 1000
      );

      const updatedOrder = await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
<<<<<<< HEAD
          rentalEndDate: shouldUpdateOrderDates
            ? input.newEndDate
            : order.rentalEndDate,
          dueDateTime: shouldUpdateOrderDates
            ? newDueDateTime
            : order.dueDateTime,
          subtotal:
            input.updateOrderTotal === false
              ? order.subtotal
              : order.subtotal.plus(itemAdditionalAmount),
          totalAmount:
            input.updateOrderTotal === false
              ? order.totalAmount
              : order.totalAmount.plus(totalAdditionalAmount),
=======
          rentalEndDate: input.newEndDate,
          dueDateTime: newDueDateTime,
          subtotal: order.subtotal.plus(additionalAmount),
>>>>>>> origin/dev
        },
        include: { items: true, extensions: true },
      });

<<<<<<< HEAD
=======
      if (additionalAmount.gt(0)) {
        await this.journalService.postRentalDeposit(
          companyId,
          extension.id,
          order.orderNumber!,
          Number(additionalAmount),
          'CASH',
          tx
        );
      }

>>>>>>> origin/dev
      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ORDER_EXTENDED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: order.id,
<<<<<<< HEAD
        businessDate: input.businessDate ?? new Date(),
        payloadSnapshot: {
          extensionNumber,
          additionalDays: maxAdditionalDays,
          itemAdditionalAmount: itemAdditionalAmount.toString(),
          deliveryFee: deliveryFee.toString(),
          deliveryFeeLabel: input.deliveryFeeLabel,
          additionalAmount: totalAdditionalAmount.toString(),
          amountBasis:
            isItemLevelExtension
              ? 'selected_order_items'
              : input.additionalAmount === undefined
                ? 'captured_order_line_prices'
                : 'manual_override',
          extensionId: extension.id,
          extensionItems: extensionItems.map((item) => ({
            rentalOrderItemId: item.rentalOrderItem?.connect?.id,
            rentalItemId: item.rentalItem?.connect?.id,
            rentalBundleId: item.rentalBundle?.connect?.id,
            quantity: item.quantity,
            previousEndDate: toIsoString(item.previousEndDate),
            newEndDate: toIsoString(item.newEndDate),
            additionalDays: item.additionalDays,
            unitPrice: item.unitPrice.toString(),
            additionalAmount: item.additionalAmount.toString(),
          })),
          isPaid: input.isPaid ?? false,
          paidAt: input.paidAt?.toISOString(),
          paymentId: input.paymentId,
          updateOrderTotal: input.updateOrderTotal !== false,
          updateOrderDates: shouldUpdateOrderDates,
        },
      });

      return updatedOrder.id;
    });

    const updatedOrder = await this.repository.findOrderById(orderId);
    if (!updatedOrder) {
      throw new DomainError(
        'Extended order not found',
        500,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    return updatedOrder;
  }
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
=======
        businessDate: new Date(),
        payloadSnapshot: {
          extensionNumber,
          additionalDays,
          additionalAmount: additionalAmount.toString(),
        },
      });

      return updatedOrder;
    });
  }
}
>>>>>>> origin/dev
