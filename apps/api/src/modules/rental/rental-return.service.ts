/**
 * Rental Return Service
 *
 * Handles return processing, settlement, and invoicing.
 * Extracted from rental.service.ts for better maintainability.
 */

import { prisma } from '@sync-erp/database';
import {
  RentalReturn,
  RentalOrderStatus,
  RentalPaymentStatus,
  UnitStatus,
  ReturnStatus,
  InvoiceType,
  InvoiceStatus,
  EntityType,
  AuditLogAction,
  JournalSourceType,
  Prisma,
} from '@sync-erp/database';
import { RentalRepository } from './rental.repository';
import { JournalService } from '../accounting/services/journal.service';
import { RentalPolicy as Policy } from './rental.policy';
import { recordAudit } from '../common/audit/audit-log.service';
import {
  DomainError,
  DomainErrorCodes,
  requireOrderNumber,
  type ProcessReturnInput,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import {
  calculateLateFee,
  calculateReturnSettlement,
} from './rules/late-fee';
import { z } from 'zod';
import { isBillingFeatureEnabled } from '../billing/billing-limits.service';

// Zod Schema for type-safe JSON parsing
const RentalPolicySnapshotSchema = z.object({
  gracePeriodHours: z.number(),
  lateFeeDailyRate: z.number(),
  cleaningFee: z.number(),
  pickupGracePeriodHours: z.number(),
});

const ReturnNotesMetadataSchema = z.object({
  damagePaid: z.number().optional(),
});

type RentalPolicySnapshot = z.infer<
  typeof RentalPolicySnapshotSchema
>;

const DEFAULT_POLICY: RentalPolicySnapshot = {
  gracePeriodHours: 2,
  lateFeeDailyRate: 0,
  cleaningFee: 0,
  pickupGracePeriodHours: 2,
};

/**
 * Safely parse policySnapshot JSON from database with validation
 */
function parsePolicySnapshot(json: unknown): RentalPolicySnapshot {
  const result = RentalPolicySnapshotSchema.safeParse(json);
  return result.success ? result.data : DEFAULT_POLICY;
}

export class RentalReturnService {
  constructor(
    private readonly repository: RentalRepository = new RentalRepository(),
    private readonly journalService: JournalService = new JournalService()
  ) {}

  async processReturn(
    companyId: string,
    input: ProcessReturnInput,
    userId: string
  ): Promise<RentalReturn> {
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

      Policy.ensureCanReturn(order);

      // Check if return already exists
      const existingReturn = await tx.rentalReturn.findUnique({
        where: { rentalOrderId: order.id },
      });
      if (existingReturn) {
        throw new DomainError(
          'Return sudah pernah diproses untuk order ini',
          400,
          DomainErrorCodes.RETURN_ALREADY_PROCESSED
        );
      }

      // Calculate charges
      const policy = parsePolicySnapshot(order.policySnapshot);
      const lateFeeCalc = calculateLateFee(
        order.dueDateTime,
        input.actualReturnDate,
        policy.gracePeriodHours || 2,
        new Decimal(policy.lateFeeDailyRate || 0),
        order.subtotal.div(
          Math.ceil(
            (order.rentalEndDate.getTime() -
              order.rentalStartDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      );

      // Sum damage charges
      let damageCharges = new Decimal(0);
      const hasMediaAccess = await isBillingFeatureEnabled({
        companyId,
        feature: 'mediaAccess',
      });

      const rawUnits =
        input.unitReturns && input.unitReturns.length > 0
          ? input.unitReturns
          : input.units;

      // Batch fetch units
      const unitIds = rawUnits.map((u) => u.unitId);
      const unitsList = await tx.rentalItemUnit.findMany({
        where: { id: { in: unitIds } },
        include: {
          rentalItem: {
            include: {
              product: { include: { category: true } },
            },
          },
        },
      });
      const unitsMap = new Map(unitsList.map((u) => [u.id, u]));

      // Batch fetch damage policies
      const damagePolicies = await tx.rentalDamagePolicy.findMany({
        where: { companyId, isActive: true },
        orderBy: [{ rentalItemId: 'desc' }, { category: 'desc' }],
      });

      for (const u of rawUnits) {
        const afterPhotos = u.afterPhotos ?? [];

        if (!hasMediaAccess && afterPhotos.length > 0) {
          throw new DomainError(
            'Media access is not available on your current plan',
            403,
            DomainErrorCodes.OPERATION_NOT_ALLOWED
          );
        }

        if (!u.damageSeverity) continue;

        const unit = unitsMap.get(u.unitId);
        if (!unit) continue;

        const matchedPolicy = damagePolicies.find(
          (p) =>
            p.severity === u.damageSeverity &&
            (p.rentalItemId === unit.rentalItemId ||
              (p.category ===
                unit.rentalItem?.product?.category?.name &&
                !p.rentalItemId) ||
              (!p.category && !p.rentalItemId))
        );

        const severityCharge = matchedPolicy
          ? Number(matchedPolicy.charge)
          : u.damageSeverity === 'MINOR'
            ? 50000
            : u.damageSeverity === 'MAJOR'
              ? 150000
              : u.damageSeverity === 'UNUSABLE'
                ? 500000
                : 0;

        damageCharges = damageCharges.plus(severityCharge);
      }

      // Settlement calculation
      const settlement = calculateReturnSettlement(
        lateFeeCalc,
        damageCharges,
        order.depositAmount
      );

      // Create condition logs
      await Promise.all(
        rawUnits.map((unit) =>
          tx.itemConditionLog.create({
            data: {
              rentalItemUnitId: unit.unitId,
              rentalOrderId: order.id,
              conditionType: 'RETURN',
              beforePhotos: [],
              afterPhotos: unit.afterPhotos ?? [],
              condition:
                unit.conditionStatus === 'DIRTY'
                  ? 'FAIR'
                  : unit.conditionStatus === 'DAMAGED'
                    ? 'NEEDS_REPAIR'
                    : unit.condition ?? 'GOOD',
              damageSeverity: unit.damageSeverity || null,
              notes:
                unit.damageNotes ??
                unit.notes ??
                (hasMediaAccess ? undefined : 'No media access on current plan'),
              recordedAt: input.actualReturnDate,
              assessedBy: userId,
            },
          })
        )
      );

      // Determine damage / return payment made on the spot
      const damagePaidAmount = input.damagePayment?.amount ?? 0;
      const isSettled =
        settlement.totalCharges.isZero() ||
        (damagePaidAmount > 0 &&
          new Decimal(damagePaidAmount).gte(settlement.totalCharges));

      // On-the-spot fee journal posting (damage fee & late fee) (N3)
      if (input.damagePayment && input.damagePayment.amount > 0) {
        const totalPaid = new Decimal(input.damagePayment.amount);
        const damageAmount = damageCharges.gt(0)
          ? Decimal.min(totalPaid, damageCharges)
          : new Decimal(0);
        const remainingPaid = totalPaid.minus(damageAmount);
        const lateAmount = lateFeeCalc.grandTotal.gt(0)
          ? Decimal.min(remainingPaid, lateFeeCalc.grandTotal)
          : new Decimal(0);

        const journalDate =
          input.actualReturnDate > new Date()
            ? new Date()
            : input.actualReturnDate;

        const orderNumber = requireOrderNumber(order, 'Rental Return Fee');

        if (damageAmount.gt(0)) {
          await this.journalService.postRentalDamageFee({
            companyId,
            orderId: order.id,
            orderNumber,
            damageFeeAmount: damageAmount.toNumber(),
            paymentAccountId: input.damagePayment.paymentAccountId,
            paymentMethod: input.damagePayment.paymentMethod,
            customerName: order.partner?.name,
            tx,
            businessDate: journalDate,
          });
        }

        if (lateAmount.gt(0)) {
          await this.journalService.postRentalLateFee({
            companyId,
            orderId: order.id,
            orderNumber,
            lateFeeAmount: lateAmount.toNumber(),
            paymentAccountId: input.damagePayment.paymentAccountId,
            paymentMethod: input.damagePayment.paymentMethod,
            customerName: order.partner?.name,
            tx,
            businessDate: journalDate,
          });
        }
      }

      // Route units: ONLY transition out of RENTED when settled (N1)!
      // When unsettled (isSettled === false), keep units RENTED to preserve the invariant that active orders hold their units.
      if (isSettled) {
        const availableUnitIds: string[] = [];
        const maintenanceUnitIds: string[] = [];

        for (const u of rawUnits) {
          const isDamagedOrDirty =
            u.conditionStatus === 'DIRTY' ||
            u.conditionStatus === 'DAMAGED' ||
            Boolean(u.damageSeverity) ||
            u.condition === 'NEEDS_REPAIR' ||
            u.condition === 'FAIR';

          if (isDamagedOrDirty) {
            maintenanceUnitIds.push(u.unitId);
          } else {
            availableUnitIds.push(u.unitId);
          }
        }

        if (availableUnitIds.length > 0) {
          // Protect units that are already assigned to another ACTIVE order from being set to AVAILABLE
          const activeAssignments = await tx.rentalOrderUnitAssignment.findMany({
            where: {
              rentalItemUnitId: { in: availableUnitIds },
              rentalOrderId: { not: order.id },
              rentalOrder: { status: RentalOrderStatus.ACTIVE },
            },
            select: { rentalItemUnitId: true },
          });
          const activeUnitIds = new Set(
            activeAssignments.map((a) => a.rentalItemUnitId)
          );
          const trulyAvailableUnitIds = availableUnitIds.filter(
            (id) => !activeUnitIds.has(id)
          );

          if (trulyAvailableUnitIds.length > 0) {
            await tx.rentalItemUnit.updateMany({
              where: { id: { in: trulyAvailableUnitIds } },
              data: { status: UnitStatus.AVAILABLE },
            });
          }

          if (activeUnitIds.size > 0) {
            await tx.rentalItemUnit.updateMany({
              where: { id: { in: Array.from(activeUnitIds) } },
              data: { status: UnitStatus.RENTED },
            });
          }
        }

        if (maintenanceUnitIds.length > 0) {
          // Protect units that are active in another order from being set to MAINTENANCE (M7)
          const activeMaintenanceAssignments =
            await tx.rentalOrderUnitAssignment.findMany({
              where: {
                rentalItemUnitId: { in: maintenanceUnitIds },
                rentalOrderId: { not: order.id },
                rentalOrder: { status: RentalOrderStatus.ACTIVE },
              },
              select: { rentalItemUnitId: true },
            });
          const activeMaintenanceUnitIds = new Set(
            activeMaintenanceAssignments.map((a) => a.rentalItemUnitId)
          );
          const trulyMaintenanceUnitIds = maintenanceUnitIds.filter(
            (id) => !activeMaintenanceUnitIds.has(id)
          );

          if (trulyMaintenanceUnitIds.length > 0) {
            await tx.rentalItemUnit.updateMany({
              where: { id: { in: trulyMaintenanceUnitIds } },
              data: { status: UnitStatus.MAINTENANCE },
            });
          }

          if (activeMaintenanceUnitIds.size > 0) {
            await tx.rentalItemUnit.updateMany({
              where: { id: { in: Array.from(activeMaintenanceUnitIds) } },
              data: { status: UnitStatus.RENTED },
            });
          }
        }
      }

      // Create return record
      const rentalReturn = await tx.rentalReturn.create({
        data: {
          rentalOrderId: order.id,
          companyId,
          returnedAt: input.actualReturnDate,
          baseRentalFee: order.subtotal,
          lateFee: lateFeeCalc.totalLateFee,
          damageCharges,
          cleaningFee: new Decimal(policy.cleaningFee || 0),
          totalCharges: settlement.totalCharges,
          depositDeduction: settlement.depositDeduction,
          depositRefund: settlement.depositRefund,
          additionalChargesDue: settlement.additionalChargesDue,
          settlementStatus: isSettled ? ReturnStatus.SETTLED : ReturnStatus.DRAFT,
          settledAt: isSettled ? new Date() : null,
          processedBy: userId,
          notes:
            damagePaidAmount > 0
              ? JSON.stringify({ damagePaid: damagePaidAmount })
              : null,
        },
      });

      // Update order status if settled
      if (isSettled) {
        await tx.rentalOrder.update({
          where: { id: order.id },
          data: {
            status: RentalOrderStatus.COMPLETED,
            rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
            paymentConfirmedAt: new Date(),
            completedAt: new Date(),
          },
        });
      }

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_RETURN_PROCESSED,
        entityType: EntityType.RENTAL_RETURN,
        entityId: rentalReturn.id,
        businessDate: new Date(),
        payloadSnapshot: {
          orderId: order.id,
          lateFee: lateFeeCalc.totalLateFee.toString(),
          damages: damageCharges.toString(),
        } as Prisma.InputJsonValue,
      });

      return rentalReturn;
    });
  }

  async finalizeReturn(
    companyId: string,
    returnId: string,
    userId: string
  ): Promise<RentalReturn> {
    return prisma.$transaction(async (tx) => {
      const returnRecord = await tx.rentalReturn.findUnique({
        where: { id: returnId },
        include: {
          rentalOrder: {
            include: { partner: true, unitAssignments: true },
          },
        },
      });

      if (!returnRecord || returnRecord.companyId !== companyId) {
        throw new DomainError(
          'Return not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      Policy.validateSettlement(returnRecord);

      // Route units according to condition logs (Clean -> AVAILABLE, Soiled/Damaged -> MAINTENANCE) (H6/FR-012)
      // Never set units to CLEANING
      const conditionLogs = await tx.itemConditionLog.findMany({
        where: {
          rentalOrderId: returnRecord.rentalOrderId,
          conditionType: 'RETURN',
        },
        orderBy: { recordedAt: 'desc' },
      });
      const logsByUnitId = new Map(
        conditionLogs.map((l) => [l.rentalItemUnitId, l])
      );

      const assignedUnitIds = returnRecord.rentalOrder.unitAssignments.map(
        (a) => a.rentalItemUnitId
      );

      const availableUnitIds: string[] = [];
      const maintenanceUnitIds: string[] = [];

      for (const unitId of assignedUnitIds) {
        const log = logsByUnitId.get(unitId);
        const isDamagedOrDirty =
          log &&
          (Boolean(log.damageSeverity) ||
            log.condition === 'NEEDS_REPAIR' ||
            log.condition === 'FAIR');

        if (isDamagedOrDirty) {
          maintenanceUnitIds.push(unitId);
        } else {
          availableUnitIds.push(unitId);
        }
      }

      if (availableUnitIds.length > 0) {
        // Protect units that are already assigned to another ACTIVE order from being set to AVAILABLE
        const activeAssignments = await tx.rentalOrderUnitAssignment.findMany({
          where: {
            rentalItemUnitId: { in: availableUnitIds },
            rentalOrderId: { not: returnRecord.rentalOrderId },
            rentalOrder: { status: RentalOrderStatus.ACTIVE },
          },
          select: { rentalItemUnitId: true },
        });
        const activeUnitIds = new Set(
          activeAssignments.map((a) => a.rentalItemUnitId)
        );
        const trulyAvailableUnitIds = availableUnitIds.filter(
          (id) => !activeUnitIds.has(id)
        );

        if (trulyAvailableUnitIds.length > 0) {
          await tx.rentalItemUnit.updateMany({
            where: { id: { in: trulyAvailableUnitIds } },
            data: { status: UnitStatus.AVAILABLE },
          });
        }
      }

      if (maintenanceUnitIds.length > 0) {
        // Protect units that are active in another order from being set to MAINTENANCE (M7)
        const activeMaintenanceAssignments =
          await tx.rentalOrderUnitAssignment.findMany({
            where: {
              rentalItemUnitId: { in: maintenanceUnitIds },
              rentalOrderId: { not: returnRecord.rentalOrderId },
              rentalOrder: { status: RentalOrderStatus.ACTIVE },
            },
            select: { rentalItemUnitId: true },
          });
        const activeMaintenanceUnitIds = new Set(
          activeMaintenanceAssignments.map((a) => a.rentalItemUnitId)
        );
        const trulyMaintenanceUnitIds = maintenanceUnitIds.filter(
          (id) => !activeMaintenanceUnitIds.has(id)
        );

        if (trulyMaintenanceUnitIds.length > 0) {
          await tx.rentalItemUnit.updateMany({
            where: { id: { in: trulyMaintenanceUnitIds } },
            data: { status: UnitStatus.MAINTENANCE },
          });
        }
      }

      // Finalize return atomically (H7 idempotency guard)
      const finalizeResult = await tx.rentalReturn.updateMany({
        where: {
          id: returnId,
          settlementStatus: ReturnStatus.DRAFT,
        },
        data: {
          settlementStatus: ReturnStatus.SETTLED,
          settledAt: new Date(),
          settledBy: userId,
        },
      });

      if (finalizeResult.count === 0) {
        throw new DomainError(
          'Return is no longer in DRAFT status or has already been finalized',
          409,
          DomainErrorCodes.ORDER_INVALID_STATE
        );
      }

      const finalized = await tx.rentalReturn.findUniqueOrThrow({
        where: { id: returnId },
      });

      // Complete order atomically
      await tx.rentalOrder.updateMany({
        where: {
          id: returnRecord.rentalOrderId,
          status: RentalOrderStatus.ACTIVE,
        },
        data: {
          status: RentalOrderStatus.COMPLETED,
          rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
          paymentConfirmedAt: returnRecord.settledAt ?? new Date(),
          completedAt: new Date(),
        },
      });

      // Spec 045 Down Payment model (H6):
      // - Do NOT debit account 2400 (liability was 2200 and already recognized upon release)
      // - Do NOT refund already recognized rental revenue (4200)
      // - Return charges are either settled on the spot via damagePayment in processReturn,
      //   or billed via createInvoiceFromReturn. finalizeReturn completes the return settlement
      //   and releases the units without creating phantom cash receipts or duplicate journals.

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_RETURN_SETTLED,
        entityType: EntityType.RENTAL_RETURN,
        entityId: returnId,
        businessDate: new Date(),
      });

      return finalized;
    });
  }

  async createInvoiceFromReturn(companyId: string, returnId: string) {
    return prisma.$transaction(async (tx) => {
      const returnRecord = await tx.rentalReturn.findUnique({
        where: { id: returnId },
        include: { rentalOrder: { include: { partner: true } } },
      });

      if (!returnRecord || returnRecord.companyId !== companyId) {
        throw new DomainError(
          'Return not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      // Guard against duplicate active invoices for the same rental return
      const existingInvoice = await tx.invoice.findFirst({
        where: {
          companyId,
          type: InvoiceType.RENTAL,
          status: { not: InvoiceStatus.VOID },
          notes: {
            contains: `Ref: ${returnRecord.rentalOrder.orderNumber}`,
          },
        },
      });

      if (existingInvoice) {
        throw new DomainError(
          'Invoice already exists for this rental return',
          409,
          DomainErrorCodes.ORDER_INVALID_STATE
        );
      }

      // Determine damage / return fee already paid on the spot (N2)
      let damagePaid = new Decimal(0);
      if (returnRecord.notes) {
        try {
          const parsed: unknown = JSON.parse(returnRecord.notes);
          const validated = ReturnNotesMetadataSchema.safeParse(parsed);
          if (
            validated.success &&
            typeof validated.data.damagePaid === 'number'
          ) {
            damagePaid = new Decimal(validated.data.damagePaid);
          }
        } catch {
          // not json
        }
      }
      if (damagePaid.isZero()) {
        const returnJournals = await tx.journalEntry.findMany({
          where: {
            companyId,
            sourceType: JournalSourceType.RENTAL_RETURN,
            sourceId: {
              in: [
                returnRecord.rentalOrderId,
                `${returnRecord.rentalOrderId}:late`,
                `${returnRecord.rentalOrderId}:damage`,
              ],
            },
          },
          include: { lines: true },
        });
        for (const entry of returnJournals) {
          for (const line of entry.lines) {
            if (line.credit && new Decimal(line.credit).gt(0)) {
              damagePaid = damagePaid.plus(line.credit);
            }
          }
        }
      }

      const baseDue = returnRecord.additionalChargesDue.gt(0)
        ? returnRecord.additionalChargesDue
        : returnRecord.totalCharges;

      const invoiceAmount = Decimal.max(0, baseDue.minus(damagePaid));

      if (invoiceAmount.lte(0)) {
        throw new DomainError(
          'No additional charges due for this return',
          400,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }

      // Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          companyId,
          partnerId: returnRecord.rentalOrder.partnerId,
          type: InvoiceType.RENTAL,
          status: InvoiceStatus.DRAFT,
          dueDate: new Date(),
          amount: invoiceAmount,
          subtotal: invoiceAmount,
          taxAmount: 0,
          balance: invoiceAmount,
          notes: `Auto-generated invoice for rental overage charges. Ref: ${returnRecord.rentalOrder.orderNumber}`,
          items: {
            create: [
              {
                description:
                  'Additional Rental Charges (Late/Damage/Cleaning)',
                quantity: 1,
                price: invoiceAmount,
                amount: invoiceAmount,
              },
            ],
          },
        },
      });

      return invoice;
    });
  }
}
