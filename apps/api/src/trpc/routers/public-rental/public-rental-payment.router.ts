/**
 * Public Rental Payment Router
 *
 * Handles payment-related operations for external integrations.
 * Extracted from public-rental.router.ts for maintainability.
 */

import { apiKeyProcedure, router } from '../../trpc';
import { z } from 'zod';
import {
  prisma,
  RentalOrderStatus,
  RentalPaymentStatus,
} from '@sync-erp/database';
import { TRPCError } from '@trpc/server';
import { DomainError } from '@sync-erp/shared';
import { webhookService as tenantWebhookService } from '../../../services/webhook.service';
import { RentalExternalOrderService } from '../../../modules/rental/rental-external-order.service';

const rentalExternalOrderService = new RentalExternalOrderService();

const toTrpcError = (err: DomainError) =>
  new TRPCError({
    code: err.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
    message: err.message,
    cause: err,
  });

export const publicRentalPaymentRouter = router({
  /**
   * Update payment method on an existing order
   * Called when customer selects payment method at checkout
   */
  updatePaymentMethod: apiKeyProcedure
    .input(
      z.object({
        token: z.string().uuid(),
        paymentMethod: z.enum(['qris', 'transfer', 'gopay']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find order by token
      const order = await prisma.rentalOrder.findFirst({
        where: {
          publicToken: input.token,
          companyId: ctx.companyId,
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          rentalPaymentStatus: true,
        },
      });

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // Only allow update if order is still in DRAFT status and payment is PENDING
      if (order.status !== RentalOrderStatus.DRAFT) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot update payment method. Order status: ${order.status}`,
        });
      }

      if (order.rentalPaymentStatus !== RentalPaymentStatus.PENDING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot update payment method. Payment status: ${order.rentalPaymentStatus}`,
        });
      }

      // Update payment method
      const updatedOrder = await prisma.rentalOrder.update({
        where: { id: order.id },
        data: {
          paymentMethod: input.paymentMethod,
        },
        select: {
          id: true,
          orderNumber: true,
          rentalPaymentStatus: true,
          totalAmount: true,
          paymentMethod: true,
          paymentReference: true,
        },
      });

      tenantWebhookService
        .notifyTenant(ctx.companyId, 'rental.payment.confirmed', {
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          rentalPaymentStatus: updatedOrder.rentalPaymentStatus,
          totalAmount: updatedOrder.totalAmount,
          paymentMethod: updatedOrder.paymentMethod,
          paymentReference: updatedOrder.paymentReference,
        })
        .catch((err: unknown) => {
          console.error(
            '[PublicRental] Tenant payment webhook failed:',
            err
          );
        });

      return {
        success: true,
        orderNumber: updatedOrder.orderNumber,
        paymentMethod: updatedOrder.paymentMethod,
      };
    }),

  /**
   * Confirm payment - called when customer clicks "I've paid"
   * Updates order payment status to AWAITING_CONFIRM
   */
  confirmPayment: apiKeyProcedure
    .input(
      z.object({
        token: z.string().uuid(),
        paymentMethod: z.enum(['qris', 'transfer', 'gopay']),
        reference: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find order by token
      const order = await prisma.rentalOrder.findFirst({
        where: {
          publicToken: input.token,
          companyId: ctx.companyId,
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
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // Validate current status - only PENDING can transition to AWAITING_CONFIRM
      if (order.rentalPaymentStatus !== RentalPaymentStatus.PENDING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot confirm payment. Current status: ${order.rentalPaymentStatus}`,
        });
      }

      // Update payment status
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

      // Fire multi-tenant webhook (async, non-blocking)
      tenantWebhookService
        .notifyTenant(ctx.companyId, 'rental.payment.claimed', {
          id: order.id,
          orderNumber: order.orderNumber || '',
          rentalPaymentStatus: 'AWAITING_CONFIRM',
          totalAmount: order.totalAmount,
          paymentMethod: input.paymentMethod,
          paymentReference: input.reference || null,
        })
        .catch((err: unknown) => {
          console.error(
            '[PublicRental] Tenant payment webhook failed:',
            err
          );
        });

      return {
        success: true,
        orderNumber: updatedOrder.orderNumber,
        rentalPaymentStatus: updatedOrder.rentalPaymentStatus,
        paymentClaimedAt: updatedOrder.paymentClaimedAt,
      };
    }),

  /**
   * Confirm payment by Order Number (Internal/Webhook Use)
   * Used by Midtrans webhook to confirm payment via Order Number
   */
  confirmPaymentByOrderNumber: apiKeyProcedure
    .input(
      z.object({
        orderNumber: z.string(),
        paymentMethod: z.string(),
        transactionId: z.string().optional(),
        amount: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await rentalExternalOrderService.confirmPaymentByOrderNumber(
          ctx.companyId,
          input
        );
      } catch (err) {
        if (err instanceof DomainError) {
          throw toTrpcError(err);
        }
        throw err;
      }
    }),

  /**
   * Reject payment by Order Number (Internal/Webhook Use)
   * Used by Midtrans webhook to mark expired/denied/cancelled payments as failed.
   */
  rejectPaymentByOrderNumber: apiKeyProcedure
    .input(
      z.object({
        orderNumber: z.string(),
        paymentMethod: z.string().optional(),
        failReason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await rentalExternalOrderService.rejectPaymentByOrderNumber(
          ctx.companyId,
          input
        );
      } catch (err) {
        if (err instanceof DomainError) {
          throw toTrpcError(err);
        }
        throw err;
      }
    }),
});
