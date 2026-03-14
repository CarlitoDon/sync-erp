/**
 * Rental Order Payment Service
 *
 * Handles payment verification for rental orders.
 */

import { Prisma, prisma } from '@sync-erp/database';
import {
  RentalOrder,
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
  AuditLogAction,
  EntityType,
} from '@sync-erp/database';
import { RentalWebhookService } from './rental-webhook.service';
import { recordAudit } from '../common/audit/audit-log.service';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

export class RentalOrderPaymentService {
  constructor(
    private readonly webhookService?: RentalWebhookService
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
