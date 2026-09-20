import {
  prisma,
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { ExternalOrderNotificationService } from './external-order-notification.service.js';
import type {
  RentalIntegrationClaimPaymentInput,
  RentalIntegrationConfirmPaymentInput,
  RentalIntegrationRejectPaymentInput,
} from '../rental-integration.schemas';

export class ExternalOrderPaymentService {
  constructor(
    private readonly notificationService: ExternalOrderNotificationService = new ExternalOrderNotificationService()
  ) {}

  async claimPayment(
    companyId: string,
    input: RentalIntegrationClaimPaymentInput
  ) {
    const order = await prisma.rentalOrder.findFirst({
      where: {
        publicToken: input.token,
        companyId,
      },
      select: {
        id: true,
        orderNumber: true,
        rentalPaymentStatus: true,
        status: true,
        companyId: true,
        totalAmount: true,
      },
    });

    if (!order) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    if (order.rentalPaymentStatus !== RentalPaymentStatus.PENDING) {
      throw new DomainError(
        `Cannot claim payment. Current status: ${order.rentalPaymentStatus}`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    const updatedOrder = await prisma.rentalOrder.update({
      where: { id: order.id },
      data: {
        rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
        paymentClaimedAt: new Date(),
        paymentMethod: input.paymentMethod,
        paymentReference: input.reference || null,
      },
      select: {
        orderNumber: true,
        rentalPaymentStatus: true,
        paymentClaimedAt: true,
        paymentMethod: true,
        paymentReference: true,
      },
    });

    void this.notificationService.notifyPaymentEvent(
      companyId,
      'rental.payment.claimed',
      {
        id: order.id,
        orderNumber: order.orderNumber,
        rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
        totalAmount: order.totalAmount,
        paymentMethod: input.paymentMethod,
        paymentReference: input.reference || null,
      }
    );

    return {
      success: true,
      orderNumber: updatedOrder.orderNumber,
      rentalPaymentStatus: updatedOrder.rentalPaymentStatus,
      paymentClaimedAt: updatedOrder.paymentClaimedAt,
    };
  }

  async confirmPaymentByOrderNumber(
    companyId: string,
    input: RentalIntegrationConfirmPaymentInput
  ) {
    const order = await prisma.rentalOrder.findFirst({
      where: {
        companyId,
        orderNumber: input.orderNumber,
      },
    });

    if (!order) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    if (order.rentalPaymentStatus === RentalPaymentStatus.CONFIRMED) {
      return { success: true, status: 'ALREADY_CONFIRMED' };
    }

    // M4: Tighten payment verification so PENDING without reference/proof cannot be confirmed arbitrarily
    if (
      order.rentalPaymentStatus === RentalPaymentStatus.PENDING &&
      !input.transactionId?.trim()
    ) {
      throw new DomainError(
        'Transaction ID or reference is required to confirm a PENDING payment',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    if (
      order.orderSource === OrderSource.WEBSITE &&
      input.amount === undefined
    ) {
      throw new DomainError(
        'Payment amount is required for website orders',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    if (
      input.amount !== undefined &&
      Math.round(input.amount) !== Math.round(Number(order.totalAmount))
    ) {
      throw new DomainError(
        'Payment amount does not match the current order total',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    const updatedOrder = await prisma.rentalOrder.update({
      where: { id: order.id },
      data: {
        rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
        paymentConfirmedAt: new Date(),
        paymentMethod: input.paymentMethod,
        paymentReference: input.transactionId,
        ...(order.orderSource === OrderSource.WEBSITE &&
        order.status === RentalOrderStatus.DRAFT
          ? {
              status: RentalOrderStatus.CONFIRMED,
              confirmedAt: new Date(),
              publicTokenExpiresAt: new Date(),
            }
          : {}),
      },
    });

    void this.notificationService.notifyPaymentEvent(
      companyId,
      'rental.payment.confirmed',
      {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        rentalPaymentStatus: updatedOrder.rentalPaymentStatus,
        totalAmount: updatedOrder.totalAmount,
        paymentMethod: updatedOrder.paymentMethod,
        paymentReference: updatedOrder.paymentReference,
      }
    );

    return {
      success: true,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
    };
  }

  async rejectPaymentByOrderNumber(
    companyId: string,
    input: RentalIntegrationRejectPaymentInput
  ) {
    const order = await prisma.rentalOrder.findFirst({
      where: {
        companyId,
        orderNumber: input.orderNumber,
      },
    });

    if (!order) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    if (order.rentalPaymentStatus === RentalPaymentStatus.CONFIRMED) {
      return {
        success: true,
        orderNumber: order.orderNumber,
        status: 'ALREADY_CONFIRMED',
      };
    }

    if (order.rentalPaymentStatus === RentalPaymentStatus.FAILED) {
      return {
        success: true,
        orderNumber: order.orderNumber,
        status: 'ALREADY_FAILED',
      };
    }

    const updatedOrder = await prisma.rentalOrder.update({
      where: { id: order.id },
      data: {
        rentalPaymentStatus: RentalPaymentStatus.FAILED,
        paymentFailedAt: new Date(),
        paymentFailReason: input.failReason,
        paymentMethod: input.paymentMethod || order.paymentMethod,
      },
    });

    void this.notificationService.notifyPaymentEvent(
      companyId,
      'rental.payment.rejected',
      {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        rentalPaymentStatus: updatedOrder.rentalPaymentStatus,
        totalAmount: updatedOrder.totalAmount,
        paymentMethod: updatedOrder.paymentMethod,
        paymentReference: updatedOrder.paymentReference,
        failReason: input.failReason,
      }
    );

    return {
      success: true,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.rentalPaymentStatus,
    };
  }
}
