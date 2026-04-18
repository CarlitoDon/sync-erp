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
  type PrismaRentalOrderWithRelations,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import { calculateOptimalTier } from './rules/pricing';
import { mapToRentalOrder } from './rental.mapper';

export class RentalOrderLifecycleService {
  constructor(
    private readonly repository: RentalRepository = new RentalRepository(),
    private readonly documentNumberService: DocumentNumberService = new DocumentNumberService(),
    private readonly journalService: JournalService = new JournalService(),
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

      const tier = calculateOptimalTier(
        rentalDays,
        dailyRate,
        weeklyRate,
        monthlyRate
      );

      const itemTotal = tier.totalAmount.times(orderItem.quantity);
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
        totalAmount: subtotal,
        policySnapshot:
          (policySnapshot as Prisma.InputJsonValue) ||
          Prisma.JsonNull,
        notes: data.notes,
        createdBy: userId,
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
        },
      });

      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      if (
        order.status !== RentalOrderStatus.ACTIVE &&
        order.status !== RentalOrderStatus.CONFIRMED
      ) {
        throw new DomainError(
          'Can only extend ACTIVE or CONFIRMED orders',
          400,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }

      if (input.newEndDate <= order.rentalEndDate) {
        throw new DomainError(
          'New end date must be after current end date',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }

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

      const extension = await tx.rentalOrderExtension.create({
        data: {
          rentalOrderId: order.id,
          companyId,
          extensionNumber,
          previousEndDate: order.rentalEndDate,
          newEndDate: input.newEndDate,
          additionalDays,
          additionalAmount,
          additionalDeposit: input.additionalDeposit || 0,
          reason: input.reason,
          createdBy: userId,
        },
      });

      const newDueDateTime = new Date(
        input.newEndDate.getTime() + 18 * 60 * 60 * 1000
      );

      const updatedOrder = await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
          rentalEndDate: input.newEndDate,
          dueDateTime: newDueDateTime,
          subtotal: order.subtotal.plus(additionalAmount),
        },
        include: { items: true, extensions: true },
      });

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

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ORDER_EXTENDED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: order.id,
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
