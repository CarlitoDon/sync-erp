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
  UnitStatus,
  DepositStatus,
  ReturnStatus,
  InvoiceType,
  InvoiceStatus,
  EntityType,
  AuditLogAction,
  PaymentMethodType,
  Prisma,
} from '@sync-erp/database';
import { RentalRepository } from './rental.repository';
import { JournalService } from '../accounting/services/journal.service';
import { RentalPolicy as Policy } from './rental.policy';
import { recordAudit } from '../common/audit/audit-log.service';
import {
  DomainError,
  DomainErrorCodes,
  type ProcessReturnInput,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import {
  calculateLateFee,
  calculateReturnSettlement,
} from './rules/late-fee';
import { z } from 'zod';

// Zod Schema for type-safe JSON parsing
const RentalPolicySnapshotSchema = z.object({
  gracePeriodHours: z.number(),
  lateFeeDailyRate: z.number(),
  cleaningFee: z.number(),
  pickupGracePeriodHours: z.number(),
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

      // Batch fetch units
      const unitIds = input.units.map((u) => u.unitId);
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

      for (const u of input.units) {
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
        input.units.map((unit) =>
          tx.itemConditionLog.create({
            data: {
              rentalItemUnitId: unit.unitId,
              rentalOrderId: order.id,
              conditionType: 'RETURN',
              beforePhotos: [],
              afterPhotos: unit.afterPhotos,
              condition: unit.condition,
              damageSeverity: unit.damageSeverity || null,
              notes: unit.damageNotes,
              recordedAt: input.actualReturnDate,
              assessedBy: userId,
            },
          })
        )
      );

      // Set units to RETURNED
      await tx.rentalItemUnit.updateMany({
        where: { id: { in: input.units.map((u) => u.unitId) } },
        data: { status: UnitStatus.RETURNED },
      });

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
          settlementStatus: ReturnStatus.DRAFT,
          processedBy: userId,
        },
      });

      // Update order status
      await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
          status: RentalOrderStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

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
            include: { deposit: true, unitAssignments: true },
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

      // Update deposit status
      if (returnRecord.rentalOrder.deposit) {
        const depositStatus =
          returnRecord.depositRefund.gt(0) &&
          returnRecord.depositDeduction.gt(0)
            ? DepositStatus.PARTIAL_REFUND
            : returnRecord.depositRefund.isZero()
              ? DepositStatus.FORFEITED
              : DepositStatus.REFUNDED;

        await tx.rentalDeposit.update({
          where: { id: returnRecord.rentalOrder.deposit.id },
          data: {
            status: depositStatus,
            refundedAt:
              depositStatus !== DepositStatus.FORFEITED
                ? new Date()
                : null,
          },
        });
      }

      // Set units to CLEANING
      const unitIds = returnRecord.rentalOrder.unitAssignments.map(
        (a) => a.rentalItemUnitId
      );
      await tx.rentalItemUnit.updateMany({
        where: { id: { in: unitIds } },
        data: { status: UnitStatus.CLEANING },
      });

      // Finalize return
      const finalized = await tx.rentalReturn.update({
        where: { id: returnId },
        data: {
          settlementStatus: ReturnStatus.SETTLED,
          settledAt: new Date(),
        },
      });

      // Complete order
      await tx.rentalOrder.update({
        where: { id: returnRecord.rentalOrderId },
        data: {
          status: RentalOrderStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      // Post return journal
      if (returnRecord.rentalOrder.deposit) {
        const deposit = returnRecord.rentalOrder.deposit;
        const rentalRevenue = Number(returnRecord.totalCharges);

        await this.journalService.postRentalReturn(
          companyId,
          returnId,
          returnRecord.rentalOrder.orderNumber!,
          Number(deposit.amount),
          rentalRevenue,
          Number(returnRecord.depositRefund),
          deposit.paymentMethod || 'CASH',
          tx
        );

        // Create refund payment record
        if (returnRecord.depositRefund.gt(0)) {
          await tx.payment.create({
            data: {
              companyId,
              amount: returnRecord.depositRefund.negated(),
              method:
                (deposit.paymentMethod as PaymentMethodType) ||
                PaymentMethodType.CASH,
              paymentType: 'DEPOSIT_REFUND',
              reference: `Refund: ${returnRecord.rentalOrder.orderNumber}`,
              date: new Date(),
            },
          });
        }
      }

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

      if (returnRecord.additionalChargesDue.lte(0)) {
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
          amount: returnRecord.additionalChargesDue,
          subtotal: returnRecord.additionalChargesDue,
          taxAmount: 0,
          balance: returnRecord.additionalChargesDue,
          notes: `Auto-generated invoice for rental overage charges. Ref: ${returnRecord.rentalOrder.orderNumber}`,
          items: {
            create: [
              {
                description:
                  'Additional Rental Charges (Late/Damage/Cleaning)',
                quantity: 1,
                price: returnRecord.additionalChargesDue,
                amount: returnRecord.additionalChargesDue,
              },
            ],
          },
        },
      });

      return invoice;
    });
  }
}
