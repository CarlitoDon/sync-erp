/**
 * Rental Order Fulfillment Service
 *
 * Handles order confirmation, manual confirmation, and release.
 */

import { prisma } from '@sync-erp/database';
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
import { recordAudit } from '../common/audit/audit-log.service';
import {
  DomainError,
  DomainErrorCodes,
  type ConfirmRentalOrderInput,
  type ManualConfirmRentalOrderInput,
  type ReleaseRentalOrderInput,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

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
}
