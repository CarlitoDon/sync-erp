import { Decimal } from 'decimal.js';
import {
  AuditLogAction,
  EntityType,
  PaymentMethodType,
  prisma,
  RentalOrder,
  RentalOrderStatus,
  RentalPaymentStatus,
  ReturnStatus,
} from '@sync-erp/database';
import { JournalService } from '../accounting/services/journal.service';
import { recordAudit } from '../common/audit/audit-log.service';
import { RentalRepository } from './rental.repository';
import {
  DomainError,
  DomainErrorCodes,
  type HistoricalRentalSettlementInput,
} from '@sync-erp/shared';

export class RentalOrderHistoricalSettlementService {
  constructor(
    private readonly repository: RentalRepository = new RentalRepository(),
    private readonly journalService: JournalService = new JournalService()
  ) {}

  async settleCompletedOrder(
    companyId: string,
    input: HistoricalRentalSettlementInput,
    userId: string
  ): Promise<RentalOrder> {
    const paymentDate = input.paymentDate;
    const completedAt = input.completedAt ?? paymentDate;
    const now = new Date();

    if (paymentDate > now || completedAt > now) {
      throw new DomainError(
        'Historical settlement dates cannot be in the future',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

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

      if (order.status === RentalOrderStatus.CANCELLED) {
        throw new DomainError(
          'Cannot settle cancelled rental order',
          400,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }

      if (order.rentalEndDate > now) {
        throw new DomainError(
          'Only finished rental periods can be settled with historical settlement',
          400,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }

      if (order.return) {
        throw new DomainError(
          'Rental order already has a return/settlement record',
          409,
          DomainErrorCodes.ALREADY_EXISTS
        );
      }

      const totalAmount = new Decimal(order.totalAmount.toString());
      if (totalAmount.lte(0)) {
        throw new DomainError(
          'Rental order total must be greater than zero',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }

      const baseRentalFee = new Decimal(order.subtotal.toString());
      const otherCharges = Decimal.max(
        totalAmount.minus(baseRentalFee),
        new Decimal(0)
      );
      const paymentMethod = input.paymentMethod as PaymentMethodType;
      const notes = [
        'Historical rental settlement',
        input.notes,
        input.paymentReference
          ? `paymentReference=${input.paymentReference}`
          : undefined,
      ]
        .filter(Boolean)
        .join('\n');

      const rentalReturn = await tx.rentalReturn.create({
        data: {
          rentalOrderId: order.id,
          companyId,
          returnedAt: completedAt,
          baseRentalFee,
          lateFee: new Decimal(0),
          damageCharges: new Decimal(0),
          cleaningFee: new Decimal(0),
          otherCharges,
          totalCharges: totalAmount,
          depositDeduction: new Decimal(0),
          additionalChargesDue: new Decimal(0),
          depositRefund: new Decimal(0),
          settlementStatus: ReturnStatus.SETTLED,
          settledAt: paymentDate,
          settledBy: userId,
          processedBy: userId,
          notes,
        },
      });

      await this.journalService.postRentalReturn(
        companyId,
        rentalReturn.id,
        order.orderNumber,
        0,
        Number(totalAmount),
        0,
        paymentMethod,
        tx,
        paymentDate
      );

      const updated = await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
          status: RentalOrderStatus.COMPLETED,
          rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
          paymentConfirmedAt: paymentDate,
          paymentConfirmedBy: userId,
          paymentReference: input.paymentReference,
          confirmedAt: order.confirmedAt ?? order.rentalStartDate,
          activatedAt: order.activatedAt ?? order.rentalStartDate,
          completedAt,
          notes: order.notes
            ? `${order.notes}\n[Historical Settlement: ${notes}]`
            : `[Historical Settlement: ${notes}]`,
        },
      });

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_RETURN_SETTLED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: order.id,
        businessDate: paymentDate,
        payloadSnapshot: {
          returnId: rentalReturn.id,
          amount: totalAmount.toString(),
          paymentMethod,
          paymentReference: input.paymentReference,
          historicalSettlement: true,
        },
      });

      return updated;
    });
  }
}
