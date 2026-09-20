/**
 * Rental Order Payment Service
 *
 * Handles payment verification for rental orders.
 */

import Decimal from 'decimal.js';
import { Prisma, prisma } from '@sync-erp/database';
import {
  RentalOrder,
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
  AuditLogAction,
  EntityType,
  UnitStatus,
  DepositStatus,
  DepositPolicyType,
} from '@sync-erp/database';
import { RentalWebhookService } from './rental-webhook.service';
import { JournalService } from '../accounting/services/journal.service';
import { recordAudit } from '../common/audit/audit-log.service';
import { DomainError, DomainErrorCodes, requireOrderNumber } from '@sync-erp/shared';

export class RentalOrderPaymentService {
  constructor(
    private readonly webhookService?: RentalWebhookService,
    private readonly journalService: JournalService = new JournalService()
  ) {}

  async verifyPayment(
    companyId: string,
    orderId: string,
    action: 'confirm' | 'reject',
    userId: string,
    paymentReference?: string,
    failReason?: string
  ): Promise<RentalOrder> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.rentalOrder.findUnique({
        where: { id: orderId },
        include: { partner: true },
      });

      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      if (order.status === RentalOrderStatus.CANCELLED) {
        throw new DomainError(
          'Cannot verify payment for a cancelled order',
          400,
          DomainErrorCodes.ORDER_INVALID_STATE
        );
      }

      if (
        order.rentalPaymentStatus !== RentalPaymentStatus.AWAITING_CONFIRM &&
        order.rentalPaymentStatus !== RentalPaymentStatus.PENDING
      ) {
        throw new DomainError(
          'Only payments with AWAITING_CONFIRM or PENDING status can be verified',
          400,
          DomainErrorCodes.ORDER_INVALID_STATE
        );
      }

      const effectiveReference =
        paymentReference?.trim() || order.paymentReference?.trim();

      // M4: Tighten payment verification so PENDING without reference/proof cannot be confirmed arbitrarily
      if (
        action === 'confirm' &&
        order.rentalPaymentStatus === RentalPaymentStatus.PENDING &&
        !effectiveReference
      ) {
        throw new DomainError(
          'Payment reference or proof is required to confirm a PENDING payment; otherwise only payments with AWAITING_CONFIRM status can be verified',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }

      const shouldAutoConfirm =
        action === 'confirm' &&
        order.orderSource === OrderSource.WEBSITE &&
        order.status === RentalOrderStatus.DRAFT;

      let autoConfirmSuccess = false;
      if (shouldAutoConfirm) {
        const orderItems =
          (await tx.rentalOrderItem.findMany({
            where: { rentalOrderId: order.id },
            include: {
              rentalBundle: {
                include: {
                  components: { include: { rentalItem: true } },
                },
              },
            },
          })) || [];

        const requiredUnits: Map<string, number> = new Map();
        for (const item of orderItems) {
          if (item.rentalBundleId && item.rentalBundle?.components) {
            for (const comp of item.rentalBundle.components) {
              if (comp.rentalItemId) {
                const cur = requiredUnits.get(comp.rentalItemId) || 0;
                requiredUnits.set(
                  comp.rentalItemId,
                  cur + comp.quantity * item.quantity
                );
              }
            }
          } else if (item.rentalItemId) {
            const cur = requiredUnits.get(item.rentalItemId) || 0;
            requiredUnits.set(item.rentalItemId, cur + item.quantity);
          }
        }

        let canAssignUnits = true;
        const unitIds: string[] = [];

        for (const [rentalItemId, qty] of requiredUnits.entries()) {
          const availableUnits =
            (await tx.rentalItemUnit.findMany({
              where: {
                rentalItemId,
                companyId,
                status: UnitStatus.AVAILABLE,
              },
              take: qty,
              orderBy: { unitCode: 'asc' },
            })) || [];

          if (availableUnits.length < qty) {
            canAssignUnits = false;
            break;
          }
          unitIds.push(...availableUnits.map((u) => u.id));
        }

        if (canAssignUnits) {
          if (unitIds.length > 0) {
            const res = await tx.rentalItemUnit.updateMany({
              where: {
                id: { in: unitIds },
                status: UnitStatus.AVAILABLE,
              },
              data: { status: UnitStatus.RESERVED },
            });

            if (res.count === unitIds.length) {
              await tx.rentalOrderUnitAssignment.createMany({
                data: unitIds.map((unitId) => ({
                  rentalOrderId: order.id,
                  rentalItemUnitId: unitId,
                  lockedBy: userId,
                })),
              });
              autoConfirmSuccess = true;
            }
          } else {
            // No units required (e.g. unit test mock)
            autoConfirmSuccess = true;
          }

          if (autoConfirmSuccess) {
            const depositAmount = order.depositAmount
              ? new Decimal(order.depositAmount.toString())
              : new Decimal(0);

            if (depositAmount.gt(0)) {
              const policy = await tx.rentalPolicy.findFirst({
                where: { companyId, isActive: true },
                orderBy: { createdAt: 'desc' },
              });

              const allocations = unitIds.map((unitId) => ({
                unitId,
                maxCoveredAmount: depositAmount.dividedBy(
                  unitIds.length || 1
                ),
              }));

              await tx.rentalDeposit.create({
                data: {
                  rentalOrderId: order.id,
                  companyId,
                  amount: depositAmount,
                  policyType:
                    policy?.defaultDepositPolicyType ||
                    DepositPolicyType.PER_UNIT,
                  status: DepositStatus.COLLECTED,
                  collectedAt: new Date(),
                  paymentMethod: order.paymentMethod || 'BANK',
                  paymentReference: paymentReference || undefined,
                  allocations:
                    allocations.length > 0
                      ? { create: allocations }
                      : undefined,
                },
              });

              // Post down payment journal (FR-016)
              await this.journalService.postRentalDownPayment({
                companyId,
                orderId: order.id,
                orderNumber: requireOrderNumber(order, 'Rental Order Payment Verification'),
                downPaymentAmount: depositAmount.toNumber(),
                paymentMethod: order.paymentMethod || 'BANK',
                customerName: order.partner?.name,
                tx,
              });
            }
          }
        } else {
          console.warn(
            `[RentalOrderPaymentService] Cannot auto-confirm order ${order.id}: insufficient available units. Order remains DRAFT for manual unit assignment.`
          );
        }
      }

      const updateData: Prisma.RentalOrderUpdateInput =
        action === 'confirm'
          ? {
              rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
              paymentConfirmedAt: new Date(),
              paymentConfirmedBy: userId,
              paymentReference: effectiveReference || undefined,
              ...(autoConfirmSuccess
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
            ? autoConfirmSuccess
              ? AuditLogAction.RENTAL_ORDER_CONFIRMED
              : AuditLogAction.ORDER_CONFIRMED
            : AuditLogAction.PAYMENT_VOIDED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: orderId,
        businessDate: new Date(),
        payloadSnapshot: {
          action: `payment_${action}`,
          paymentReference,
          failReason,
          autoConfirmed: autoConfirmSuccess,
        },
      });

      // Fire webhook notification
      if (this.webhookService && order.publicToken) {
        this.webhookService
          .notifyPaymentStatus({
            companyId: order.companyId,
            token: order.publicToken,
            action: action === 'confirm' ? 'confirmed' : 'rejected',
            paymentReference,
            failReason,
          })
          .catch((err) => {
            console.error(
              '[RentalOrderPaymentService] Webhook notification failed:',
              err
            );
          });
      }

      return updated;
    });
  }
}
