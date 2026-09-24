/**
 * Rental Order Fulfillment Service
 *
 * Handles order confirmation, manual confirmation, and release.
 */

import { prisma } from '@sync-erp/database';
import {
  RentalOrder,
  RentalOrderStatus,
  RentalPaymentStatus,
  UnitStatus,
  DepositPolicyType,
  DepositStatus,
  EntityType,
  AuditLogAction,
  PaymentMethodType,
  JournalSourceType,
  OrderSource,
  UnitCondition,
} from '@sync-erp/database';
import { RentalRepository } from './rental.repository';
import { JournalService } from '../accounting/services/journal.service';
import { RentalPolicy as Policy } from './rental.policy';
import { recordAudit } from '../common/audit/audit-log.service';
import {
  DomainError,
  DomainErrorCodes,
  JOURNAL_REF_PREFIX,
  requireOrderNumber,
  type ConfirmRentalOrderInput,
  type ManualConfirmRentalOrderInput,
  type ReleaseRentalOrderInput,
  type RecordSettlementInput,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import { isBillingFeatureEnabled } from '../billing/billing-limits.service';

export class RentalOrderFulfillmentService {
  constructor(
    private readonly repository: RentalRepository = new RentalRepository(),
    private readonly journalService: JournalService = new JournalService()
  ) {}

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

      Policy.ensureCanConfirm(order);

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
          const overlappingAssignments =
            (await tx.rentalOrderUnitAssignment.findMany({
              where: {
                rentalItemUnit: {
                  rentalItemId,
                  companyId,
                },
                rentalOrder: {
                  id: { not: order.id },
                  status: {
                    in: [
                      RentalOrderStatus.CONFIRMED,
                      RentalOrderStatus.ACTIVE,
                    ],
                  },
                  rentalStartDate: { lt: order.rentalEndDate },
                  rentalEndDate: { gt: order.rentalStartDate },
                },
              },
              select: { rentalItemUnitId: true },
            })) ?? [];
          const bookedUnitIds = overlappingAssignments.map(
            (a) => a.rentalItemUnitId
          );

          const availableUnits = await tx.rentalItemUnit.findMany({
            where: {
              rentalItemId,
              companyId,
              status: UnitStatus.AVAILABLE,
              id: { notIn: bookedUnitIds },
            },
            take: qty,
            orderBy: { unitCode: 'asc' },
          });

          if (availableUnits.length < qty) {
            throw new DomainError(
              `Insufficient available units for rental item. Need ${qty}, found ${availableUnits.length}. Use manual confirmation with reason override per FR-004.`,
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

      let resolvedAccountId = input.paymentAccountId;
      let paymentMethodStr =
        input.paymentMethod ||
        order.paymentMethod ||
        PaymentMethodType.BANK;

      if (input.paymentMethodId) {
        const companyPm = await tx.companyPaymentMethod.findFirst({
          where: { id: input.paymentMethodId, companyId },
          include: { account: true },
        });
        if (companyPm) {
          paymentMethodStr = companyPm.code || companyPm.type;
          if (!resolvedAccountId && companyPm.accountId) {
            resolvedAccountId = companyPm.accountId;
          }
        }
      }

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
          paymentReference: input.paymentReference,
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

      // Update order conditionally (H7 idempotency guard)
      const isFullyPaid = depositAmount.gte(order.totalAmount);
      const updateResult = await tx.rentalOrder.updateMany({
        where: {
          id: order.id,
          status: RentalOrderStatus.DRAFT,
        },
        data: {
          status: RentalOrderStatus.CONFIRMED,
          rentalPaymentStatus: isFullyPaid
            ? RentalPaymentStatus.CONFIRMED
            : order.rentalPaymentStatus,
          paymentConfirmedAt: isFullyPaid ? new Date() : undefined,
          depositAmount,
          confirmedAt: new Date(),
          paymentMethod: paymentMethodStr || order.paymentMethod,
          paymentReference: input.paymentReference ?? order.paymentReference,
        },
      });

      if (updateResult.count === 0) {
        throw new DomainError(
          'Order is no longer in DRAFT status or has already been confirmed',
          409,
          DomainErrorCodes.ORDER_INVALID_STATE
        );
      }

      const updated = (await tx.rentalOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          items: true,
          unitAssignments: true,
          deposit: true,
        },
      })) as RentalOrder;

      // Post down payment journal (~30% DP) only if payment is confirmed (H2) and not already posted (H7)
      const isPaymentConfirmed =
        order.orderSource !== OrderSource.WEBSITE ||
        isFullyPaid ||
        order.rentalPaymentStatus === RentalPaymentStatus.CONFIRMED;

      if (depositAmount.gt(0) && isPaymentConfirmed) {
        const existingDpJournal = await tx.journalEntry.findFirst({
          where: {
            companyId,
            sourceType: JournalSourceType.RENTAL_DEPOSIT,
            sourceId: order.id,
          },
        });

        if (!existingDpJournal) {
          await this.journalService.postRentalDownPayment({
            companyId,
            orderId: order.id,
            orderNumber: requireOrderNumber(order, 'Rental DP Journal Posting'),
            downPaymentAmount: depositAmount.toNumber(),
            paymentAccountId: resolvedAccountId,
            paymentMethod: paymentMethodStr,
            customerName: order.partner?.name,
            tx,
          });
        }
      }

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

      Policy.ensureCanConfirm(order);

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
        const overlappingAssignments =
          (await tx.rentalOrderUnitAssignment.findMany({
            where: {
              rentalItemUnit: {
                rentalItemId,
                companyId,
              },
              rentalOrder: {
                id: { not: order.id },
                status: {
                  in: [
                    RentalOrderStatus.CONFIRMED,
                    RentalOrderStatus.ACTIVE,
                  ],
                },
                rentalStartDate: { lt: order.rentalEndDate },
                rentalEndDate: { gt: order.rentalStartDate },
              },
            },
            select: { rentalItemUnitId: true },
          })) ?? [];
        const bookedUnitIds = overlappingAssignments.map(
          (a) => a.rentalItemUnitId
        );

        const availableUnits = await tx.rentalItemUnit.findMany({
          where: {
            rentalItemId,
            companyId,
            status: { notIn: [UnitStatus.MAINTENANCE, UnitStatus.RETIRED] },
            id: { notIn: bookedUnitIds },
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
                status: { notIn: [UnitStatus.MAINTENANCE, UnitStatus.RETIRED] },
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
              status: { notIn: [UnitStatus.MAINTENANCE, UnitStatus.RETIRED] },
            },
            data: { status: UnitStatus.RESERVED },
          });
        }
      }

      // Update order conditionally (H7 idempotency guard)
      const isFullyPaid = depositAmount.gte(order.totalAmount);
      const updateResult = await tx.rentalOrder.updateMany({
        where: {
          id: order.id,
          status: RentalOrderStatus.DRAFT,
        },
        data: {
          status: RentalOrderStatus.CONFIRMED,
          rentalPaymentStatus: isFullyPaid
            ? RentalPaymentStatus.CONFIRMED
            : order.rentalPaymentStatus,
          paymentConfirmedAt: isFullyPaid ? new Date() : undefined,
          depositAmount,
          confirmedAt: new Date(),
          paymentMethod: paymentMethod.code || order.paymentMethod,
          paymentReference: input.paymentReference ?? order.paymentReference,
          notes: order.notes
            ? `${order.notes}\n[Manual Confirm: ${input.notes}]`
            : `[Manual Confirm: ${input.notes}]`,
        },
      });

      if (updateResult.count === 0) {
        throw new DomainError(
          'Order is no longer in DRAFT status or has already been confirmed',
          409,
          DomainErrorCodes.ORDER_INVALID_STATE
        );
      }

      const updated = (await tx.rentalOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          items: true,
          unitAssignments: true,
          deposit: true,
        },
      })) as RentalOrder;

      // Post deposit journal conditionally based on accounting treatment
      const accountingTreatment =
        input.accountingTreatment ?? 'POST_CASH_JOURNAL';
      const journalPosted = accountingTreatment === 'POST_CASH_JOURNAL';

      if (journalPosted && depositAmount.gt(0)) {
        const existingDpJournal = await tx.journalEntry.findFirst({
          where: {
            companyId,
            sourceType: JournalSourceType.RENTAL_DEPOSIT,
            sourceId: order.id,
          },
        });

        if (!existingDpJournal) {
          await this.journalService.postRentalDownPayment({
            companyId,
            orderId: order.id,
            orderNumber: requireOrderNumber(order, 'Manual Confirm DP Journal Posting'),
            downPaymentAmount: depositAmount.toNumber(),
            paymentAccountId:
              input.paymentAccountId ?? paymentMethod.accountId ?? undefined,
            paymentMethod: paymentMethod.code,
            customerName: order.partner?.name,
            tx,
          });
        }
      }

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
          accountingTreatment,
          journalPosted,
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

      const hasMediaAccess = await isBillingFeatureEnabled({
        companyId,
        feature: 'mediaAccess',
      });

      // Paid plans keep photo evidence requirements; free plans use no-media logs.
      const unitIds = input.unitAssignments.map((a) => a.unitId);

      // M1: Ensure all units being released belong to this order
      if (!order.unitAssignments || order.unitAssignments.length === 0) {
        throw new DomainError(
          `No units assigned to order ${order.id}`,
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
      const assignedUnitIds = new Set(
        order.unitAssignments.map((a) => a.rentalItemUnitId)
      );
      for (const unitId of unitIds) {
        if (!assignedUnitIds.has(unitId)) {
          throw new DomainError(
            `Unit ${unitId} is not assigned to order ${order.id}`,
            400,
            DomainErrorCodes.INVALID_INPUT
          );
        }
      }

      for (const assignment of input.unitAssignments) {
        const beforePhotos = assignment.beforePhotos ?? [];

        if (!hasMediaAccess && beforePhotos.length > 0) {
          throw new DomainError(
            'Media access is not available on your current plan',
            403,
            DomainErrorCodes.OPERATION_NOT_ALLOWED
          );
        }

        if (
          hasMediaAccess &&
          !input.skipPhotoCheck &&
          beforePhotos.length === 0
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
              beforePhotos: assignment.beforePhotos ?? [],
              afterPhotos: [],
              condition: assignment.condition ?? UnitCondition.GOOD,
              notes:
                assignment.notes ??
                (hasMediaAccess ? undefined : 'No media access on current plan'),
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

      // Update order conditionally (H7 idempotency guard)
      const releaseUpdateResult = await tx.rentalOrder.updateMany({
        where: {
          id: order.id,
          status: RentalOrderStatus.CONFIRMED,
        },
        data: {
          status: RentalOrderStatus.ACTIVE,
          activatedAt: new Date(),
        },
      });

      if (releaseUpdateResult.count === 0) {
        throw new DomainError(
          'Order is no longer in CONFIRMED status or has already been released',
          409,
          DomainErrorCodes.ORDER_INVALID_STATE
        );
      }

      const updated = (await tx.rentalOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          items: true,
          unitAssignments: true,
          deposit: true,
        },
      })) as RentalOrder;

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

  async recordSettlement(
    companyId: string,
    input: RecordSettlementInput,
    userId: string
  ): Promise<RentalOrder> {
    return prisma.$transaction(async (tx) => {
      const order = await this.repository.findOrderById(input.orderId, tx);
      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      if (order.status !== RentalOrderStatus.ACTIVE) {
        throw new DomainError(
          'Order must be in ACTIVE status to record settlement',
          409,
          DomainErrorCodes.ORDER_INVALID_STATE
        );
      }

      if (order.rentalPaymentStatus === RentalPaymentStatus.CONFIRMED) {
        throw new DomainError(
          'Order payment has already been fully settled',
          409,
          DomainErrorCodes.ORDER_INVALID_STATE
        );
      }

      const companyPaymentMethod = await tx.companyPaymentMethod.findFirst({
        where: { id: input.paymentMethodId, companyId },
        include: { account: true },
      });

      if (!companyPaymentMethod) {
        throw new DomainError(
          'Payment method not found',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }

      const totalAmount = Number(
        order.totalAmount ??
          new Decimal(order.subtotal ?? 0)
            .plus(order.deliveryFee ?? 0)
            .minus(order.discountAmount ?? 0)
            .toNumber()
      );
      const depositPaid = Number(order.depositAmount ?? 0);
      const remainingBalance = Math.max(0, totalAmount - depositPaid);
      const settlementAmount = input.settlementAmount ?? remainingBalance;
      const isFullyPaid = depositPaid + settlementAmount >= totalAmount;

      await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
          rentalPaymentStatus: isFullyPaid
            ? RentalPaymentStatus.CONFIRMED
            : order.rentalPaymentStatus,
          paymentMethod: companyPaymentMethod.code || companyPaymentMethod.type,
          paymentReference: input.reference ?? order.paymentReference,
          ...(isFullyPaid && {
            paymentConfirmedAt: new Date(),
            paymentConfirmedBy: userId,
          }),
        },
      });

      // Check if a settlement journal already exists (idempotency guard — same pattern as releaseOrder, using JOURNAL_REF_PREFIX.RENTAL_RELEASE)
      const existingReleaseJournal = await tx.journalEntry.findFirst({
        where: {
          companyId,
          sourceType: JournalSourceType.PAYMENT,
          sourceId: order.id,
          reference: { startsWith: JOURNAL_REF_PREFIX.RENTAL_RELEASE },
        },
      });

      if (!existingReleaseJournal && settlementAmount > 0) {
        await this.journalService.postRentalReleaseSettlement({
          companyId,
          orderId: order.id,
          orderNumber: requireOrderNumber(order, 'Record Settlement Journal'),
          settlementAmount,
          downPaymentAmount: Math.min(depositPaid, totalAmount),
          rentalRevenueAmount: Number(order.subtotal ?? 0),
          deliveryFeeAmount: Number(order.deliveryFee ?? 0),
          discountAmount: Number(order.discountAmount ?? 0),
          paymentAccountId: companyPaymentMethod.accountId ?? undefined,
          paymentMethod:
            companyPaymentMethod.code ||
            companyPaymentMethod.type ||
            PaymentMethodType.CASH,
          customerName: order.partner?.name,
          tx,
        });
      }

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ORDER_RELEASED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: order.id,
        businessDate: new Date(),
        payloadSnapshot: {
          action: 'SETTLEMENT_RECORDED',
          settlementAmount,
          isFullyPaid,
          paymentMethod: companyPaymentMethod.name || companyPaymentMethod.code,
        },
      });

      const updated = (await tx.rentalOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          items: true,
          unitAssignments: true,
          deposit: true,
        },
      })) as RentalOrder;

      return updated;
    });
  }
}
