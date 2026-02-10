/**
 * Rental Order Service
 *
 * Handles rental order lifecycle management.
 * Extracted from rental.service.ts for better maintainability.
 */

import { Prisma, prisma } from '@sync-erp/database';
import {
  RentalOrder,
  RentalOrderStatus,
  UnitStatus,
  DepositPolicyType,
  DepositStatus,
  EntityType,
  AuditLogAction,
  PaymentMethodType,
} from '@sync-erp/database';
import { RentalRepository } from './rental.repository';
import { JournalService } from '../accounting/services/journal.service';
import { RentalPolicy as Policy } from './rental.policy';
import { DocumentNumberService } from '../common/services/document-number.service';
import { recordAudit } from '../common/audit/audit-log.service';
import {
  DomainError,
  DomainErrorCodes,
  type CreateRentalOrderInput,
  type ConfirmRentalOrderInput,
  type ManualConfirmRentalOrderInput,
  type ReleaseRentalOrderInput,
  type PrismaRentalOrderWithRelations,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import { calculateOptimalTier } from './rules/pricing';
import { RentalWebhookService } from './rental-webhook.service';

export class RentalOrderService {
  constructor(
    private readonly repository: RentalRepository = new RentalRepository(),
    private readonly documentNumberService: DocumentNumberService = new DocumentNumberService(),
    private readonly webhookService?: RentalWebhookService,
    private readonly journalService: JournalService = new JournalService()
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
    const items = (await this.repository.listRentalOrders(companyId, {
      ...filters,
      take: take + 1,
      cursor: filters?.cursor,
    })) as unknown as PrismaRentalOrderWithRelations[];

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

  async confirmOrder(
    companyId: string,
    input: ConfirmRentalOrderInput,
    userId: string
  ): Promise<RentalOrder> {
    return prisma.$transaction(async (tx) => {
      const order = await this.repository.findOrderById(
        input.orderId,
        tx
      );
      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      if (order.status !== RentalOrderStatus.DRAFT) {
        throw new DomainError(
          'Can only confirm DRAFT orders',
          400,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }

      // Get order items with their rental item info
      const orderItems = await tx.rentalOrderItem.findMany({
        where: { rentalOrderId: order.id },
        include: {
          rentalItem: true,
          rentalBundle: {
            include: {
              components: {
                include: { rentalItem: true },
              },
            },
          },
        },
      });

      // Build list of required units per rentalItemId
      const requiredUnits: Map<string, number> = new Map();
      for (const item of orderItems) {
        if (item.rentalBundleId && item.rentalBundle?.components) {
          for (const comp of item.rentalBundle.components) {
            if (comp.rentalItemId) {
              const current =
                requiredUnits.get(comp.rentalItemId) || 0;
              requiredUnits.set(
                comp.rentalItemId,
                current + comp.quantity * item.quantity
              );
            }
          }
        } else if (item.rentalItemId) {
          const current = requiredUnits.get(item.rentalItemId) || 0;
          requiredUnits.set(
            item.rentalItemId,
            current + item.quantity
          );
        }
      }

      const totalQuantityRequired = Array.from(
        requiredUnits.values()
      ).reduce((a, b) => a + b, 0);

      // Use provided unitAssignments or auto-assign
      let unitIds: string[];
      if (input.unitAssignments && input.unitAssignments.length > 0) {
        unitIds = input.unitAssignments.map((a) => a.unitId);
        if (unitIds.length < totalQuantityRequired) {
          throw new DomainError(
            `Need ${totalQuantityRequired} units but only ${unitIds.length} provided`,
            400,
            DomainErrorCodes.INVALID_INPUT
          );
        }
      } else {
        unitIds = [];
        for (const [rentalItemId, qty] of requiredUnits.entries()) {
          const availableUnits = await tx.rentalItemUnit.findMany({
            where: {
              rentalItemId,
              companyId,
              status: UnitStatus.AVAILABLE,
            },
            take: qty,
            orderBy: { unitCode: 'asc' },
          });

          if (availableUnits.length < qty) {
            throw new DomainError(
              `Insufficient available units for rental item. Need ${qty}, found ${availableUnits.length}`,
              400,
              DomainErrorCodes.INSUFFICIENT_STOCK
            );
          }

          unitIds.push(...availableUnits.map((u) => u.id));
        }
      }

      // Validate units exist
      const units = await tx.rentalItemUnit.findMany({
        where: { id: { in: unitIds }, companyId },
      });

      if (units.length !== unitIds.length) {
        throw new DomainError(
          'One or more units not found',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }

      Policy.ensureUnitsAvailable(units, unitIds);

      // Get current policy
      let policy = await this.repository.getCurrentPolicy(companyId);
      if (!policy) {
        policy = await tx.rentalPolicy.create({
          data: {
            companyId,
            gracePeriodHours: 24,
            lateFeeDailyRate: 50000,
            cleaningFee: 25000,
            pickupGracePeriodHours: 48,
            defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
            defaultDepositPerUnit: 100000,
            createdBy: userId,
            isActive: true,
          },
        });
      }

      const depositAmount =
        input.depositAmount !== undefined && input.depositAmount > 0
          ? new Decimal(input.depositAmount)
          : order.depositAmount
            ? new Decimal(order.depositAmount.toString())
            : new Decimal(0);

      const paymentMethodStr =
        input.paymentMethod ||
        order.paymentMethod ||
        PaymentMethodType.BANK;

      const allocations = unitIds.map((unitId) => {
        const perUnitAmount = depositAmount.dividedBy(
          unitIds.length || 1
        );
        return {
          unitId,
          maxCoveredAmount: perUnitAmount,
        };
      });

      // Create deposit
      const deposit = await tx.rentalDeposit.create({
        data: {
          rentalOrderId: order.id,
          companyId,
          amount: depositAmount,
          policyType: policy.defaultDepositPolicyType,
          status: DepositStatus.COLLECTED,
          collectedAt: new Date(),
          paymentMethod: paymentMethodStr,
          allocations: {
            create: allocations,
          },
        },
      });

      // Create unit assignments
      await tx.rentalOrderUnitAssignment.createMany({
        data: unitIds.map((unitId) => ({
          rentalOrderId: order.id,
          rentalItemUnitId: unitId,
          lockedBy: userId,
        })),
      });

      // Reserve units (Optimistic Locking)
      const reservationResult = await tx.rentalItemUnit.updateMany({
        where: {
          id: { in: unitIds },
          status: UnitStatus.AVAILABLE,
        },
        data: { status: UnitStatus.RESERVED },
      });

      if (reservationResult.count !== unitIds.length) {
        throw new DomainError(
          'One or more units were reserved by another user. Please try again.',
          409,
          DomainErrorCodes.INSUFFICIENT_STOCK
        );
      }

      // Update order
      const updated = await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
          status: RentalOrderStatus.CONFIRMED,
          depositAmount,
          confirmedAt: new Date(),
        },
        include: {
          items: true,
          unitAssignments: true,
          deposit: true,
        },
      });

      // Post deposit journal
      await this.journalService.postRentalDeposit(
        companyId,
        deposit.id,
        order.orderNumber!,
        Number(depositAmount),
        paymentMethodStr,
        tx
      );

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ORDER_CONFIRMED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: order.id,
        businessDate: new Date(),
        payloadSnapshot: { depositId: deposit.id },
      });

      return updated;
    });
  }

  async manualConfirmOrder(
    companyId: string,
    input: ManualConfirmRentalOrderInput,
    userId: string
  ): Promise<RentalOrder> {
    return prisma.$transaction(async (tx) => {
      const order = await this.repository.findOrderById(
        input.orderId,
        tx
      );
      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      if (order.status !== RentalOrderStatus.DRAFT) {
        throw new DomainError(
          'Can only confirm DRAFT orders',
          400,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }

      // Get payment method
      const paymentMethod = await tx.companyPaymentMethod.findFirst({
        where: { id: input.paymentMethodId, companyId },
        include: { account: true },
      });

      if (!paymentMethod) {
        throw new DomainError(
          'Payment method not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      // Get order items
      const orderItems = await tx.rentalOrderItem.findMany({
        where: { rentalOrderId: order.id },
        include: {
          rentalItem: true,
          rentalBundle: {
            include: {
              components: {
                include: { rentalItem: true },
              },
            },
          },
        },
      });

      // Build list of required units
      const requiredUnits: Map<string, number> = new Map();
      for (const item of orderItems) {
        if (item.rentalBundleId && item.rentalBundle?.components) {
          for (const comp of item.rentalBundle.components) {
            if (comp.rentalItemId) {
              const current =
                requiredUnits.get(comp.rentalItemId) || 0;
              requiredUnits.set(
                comp.rentalItemId,
                current + comp.quantity * item.quantity
              );
            }
          }
        } else if (item.rentalItemId) {
          const current = requiredUnits.get(item.rentalItemId) || 0;
          requiredUnits.set(
            item.rentalItemId,
            current + item.quantity
          );
        }
      }

      // AUTO-ASSIGN units
      const unitIds: string[] = [];
      for (const [rentalItemId, qty] of requiredUnits.entries()) {
        const availableUnits = await tx.rentalItemUnit.findMany({
          where: {
            rentalItemId,
            companyId,
            status: UnitStatus.AVAILABLE,
          },
          take: qty,
          orderBy: { unitCode: 'asc' },
        });

        if (!input.skipStockCheck && availableUnits.length < qty) {
          throw new DomainError(
            `Insufficient available units for rental item. Need ${qty}, found ${availableUnits.length}`,
            400,
            DomainErrorCodes.INSUFFICIENT_STOCK
          );
        }

        unitIds.push(...availableUnits.map((u) => u.id));
      }

      // Get policy
      let policy = await this.repository.getCurrentPolicy(companyId);
      if (!policy) {
        policy = await tx.rentalPolicy.create({
          data: {
            companyId,
            gracePeriodHours: 24,
            lateFeeDailyRate: 50000,
            cleaningFee: 25000,
            pickupGracePeriodHours: 48,
            defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
            defaultDepositPerUnit: 100000,
            createdBy: userId,
            isActive: true,
          },
        });
      }

      const depositAmount = new Decimal(input.paymentAmount);

      const allocations =
        unitIds.length > 0
          ? unitIds.map((unitId) => ({
              unitId,
              maxCoveredAmount: depositAmount.dividedBy(
                unitIds.length
              ),
            }))
          : [];

      // Create deposit
      const deposit = await tx.rentalDeposit.create({
        data: {
          rentalOrderId: order.id,
          companyId,
          amount: depositAmount,
          policyType: policy.defaultDepositPolicyType,
          status: DepositStatus.COLLECTED,
          collectedAt: new Date(),
          paymentMethod: paymentMethod.code,
          paymentReference: input.paymentReference,
          allocations:
            allocations.length > 0
              ? { create: allocations }
              : undefined,
        },
      });

      // Create unit assignments and reserve units
      if (unitIds.length > 0) {
        await tx.rentalOrderUnitAssignment.createMany({
          data: unitIds.map((unitId) => ({
            rentalOrderId: order.id,
            rentalItemUnitId: unitId,
            lockedBy: userId,
          })),
        });

        if (!input.skipStockCheck) {
          const reservationResult =
            await tx.rentalItemUnit.updateMany({
              where: {
                id: { in: unitIds },
                status: UnitStatus.AVAILABLE,
              },
              data: { status: UnitStatus.RESERVED },
            });

          if (reservationResult.count !== unitIds.length) {
            throw new DomainError(
              'One or more units were reserved by another user. Please try again.',
              409,
              DomainErrorCodes.INSUFFICIENT_STOCK
            );
          }
        } else {
          await tx.rentalItemUnit.updateMany({
            where: {
              id: { in: unitIds },
              status: UnitStatus.AVAILABLE,
            },
            data: { status: UnitStatus.RESERVED },
          });
        }
      }

      // Update order
      const updated = await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
          status: RentalOrderStatus.CONFIRMED,
          depositAmount,
          confirmedAt: new Date(),
          notes: order.notes
            ? `${order.notes}\n[Manual Confirm: ${input.notes}]`
            : `[Manual Confirm: ${input.notes}]`,
        },
        include: {
          items: true,
          unitAssignments: true,
          deposit: true,
        },
      });

      // Post deposit journal
      await this.journalService.postRentalDeposit(
        companyId,
        deposit.id,
        order.orderNumber!,
        Number(depositAmount),
        paymentMethod.code,
        tx
      );

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ORDER_CONFIRMED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: order.id,
        businessDate: new Date(),
        payloadSnapshot: {
          depositId: deposit.id,
          manualOverride: true,
          skipStockCheck: input.skipStockCheck,
          paymentMethodId: input.paymentMethodId,
          notes: input.notes,
        },
      });

      return updated;
    });
  }

  async releaseOrder(
    companyId: string,
    input: ReleaseRentalOrderInput,
    userId: string
  ): Promise<RentalOrder> {
    return prisma.$transaction(async (tx) => {
      const order = await this.repository.findOrderById(
        input.orderId,
        tx
      );
      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      Policy.ensureCanRelease(order);

      // Validate all units have photos
      const unitIds = input.unitAssignments.map((a) => a.unitId);
      for (const assignment of input.unitAssignments) {
        if (
          !assignment.beforePhotos ||
          assignment.beforePhotos.length === 0
        ) {
          throw new DomainError(
            'All units must have before photos',
            400,
            DomainErrorCodes.INVALID_INPUT
          );
        }
      }

      // Create condition logs
      await Promise.all(
        input.unitAssignments.map((assignment) =>
          tx.itemConditionLog.create({
            data: {
              rentalItemUnit: { connect: { id: assignment.unitId } },
              rentalOrder: { connect: { id: order.id } },
              conditionType: 'RELEASE',
              beforePhotos: assignment.beforePhotos,
              afterPhotos: [],
              condition: assignment.condition,
              notes: assignment.notes,
              recordedAt: new Date(),
              assessedBy: userId,
            },
          })
        )
      );

      // Set units to RENTED
      await tx.rentalItemUnit.updateMany({
        where: { id: { in: unitIds } },
        data: { status: UnitStatus.RENTED },
      });

      // Update order
      const updated = await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
          status: RentalOrderStatus.ACTIVE,
          activatedAt: new Date(),
        },
        include: {
          items: true,
          unitAssignments: true,
          deposit: true,
        },
      });

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ORDER_RELEASED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: order.id,
        businessDate: new Date(),
        payloadSnapshot: { unitCount: unitIds.length },
      });

      return updated;
    });
  }

  async cancelOrder(
    companyId: string,
    orderId: string,
    reason: string,
    userId: string
  ): Promise<RentalOrder> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.rentalOrder.findUnique({
        where: { id: orderId },
        include: { deposit: true },
      });
      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      if (
        order.status !== RentalOrderStatus.DRAFT &&
        order.status !== RentalOrderStatus.CONFIRMED
      ) {
        throw new DomainError(
          'Can only cancel DRAFT or CONFIRMED orders',
          400,
          DomainErrorCodes.ORDER_INVALID_STATE
        );
      }

      // Release reserved units
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
          data: { status: UnitStatus.AVAILABLE },
        });
      }

      // Handle deposit refund if collected
      if (order.deposit) {
        await tx.rentalDeposit.update({
          where: { id: order.deposit.id },
          data: {
            status: DepositStatus.REFUNDED,
            refundedAt: new Date(),
          },
        });
      }

      const updated = await tx.rentalOrder.update({
        where: { id: orderId },
        data: {
          status: RentalOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          notes: reason,
        },
      });

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ORDER_CANCELLED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: orderId,
        businessDate: new Date(),
        payloadSnapshot: { reason },
      });

      return updated;
    });
  }

  async verifyPayment(
    companyId: string,
    orderId: string,
    action: 'confirm' | 'reject',
    userId: string,
    paymentReference?: string,
    failReason?: string
  ): Promise<RentalOrder> {
    const { RentalPaymentStatus, OrderSource } =
      await import('@sync-erp/database');

    return prisma.$transaction(async (tx) => {
      const order = await tx.rentalOrder.findUnique({
        where: { id: orderId },
      });

      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      if (
        order.rentalPaymentStatus !==
        RentalPaymentStatus.AWAITING_CONFIRM
      ) {
        throw new DomainError(
          'Only payments with AWAITING_CONFIRM status can be verified',
          400,
          DomainErrorCodes.ORDER_INVALID_STATE
        );
      }

      const shouldAutoConfirm =
        action === 'confirm' &&
        order.orderSource === OrderSource.WEBSITE &&
        order.status === RentalOrderStatus.DRAFT;

      const updateData: Prisma.RentalOrderUpdateInput =
        action === 'confirm'
          ? {
              rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
              paymentConfirmedAt: new Date(),
              paymentConfirmedBy: userId,
              paymentReference: paymentReference || undefined,
              ...(shouldAutoConfirm
                ? {
                    status: RentalOrderStatus.CONFIRMED,
                    confirmedAt: new Date(),
                  }
                : {}),
            }
          : {
              rentalPaymentStatus: RentalPaymentStatus.FAILED,
              paymentFailedAt: new Date(),
              paymentFailReason:
                failReason || 'Payment verification failed',
            };

      const updated = await tx.rentalOrder.update({
        where: { id: orderId },
        data: updateData,
      });

      await recordAudit({
        companyId,
        actorId: userId,
        action:
          action === 'confirm'
            ? AuditLogAction.RENTAL_ORDER_CONFIRMED
            : AuditLogAction.RENTAL_ORDER_CANCELLED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: orderId,
        businessDate: new Date(),
        payloadSnapshot: {
          action: `payment_${action}`,
          paymentReference,
          failReason,
          autoConfirmed: shouldAutoConfirm,
        },
      });

      // Fire webhook notification
      if (this.webhookService && order.publicToken) {
        this.webhookService
          .notifyPaymentStatus({
            token: order.publicToken,
            action: action === 'confirm' ? 'confirmed' : 'rejected',
            paymentReference,
            failReason,
          })
          .catch((err) => {
            console.error(
              '[RentalOrderService] Webhook notification failed:',
              err
            );
          });
      }

      return updated;
    });
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
