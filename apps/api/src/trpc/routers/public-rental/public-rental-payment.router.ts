/**
 * Public Rental Payment Router
 *
 * Handles payment-related operations for external integrations.
 * Extracted from public-rental.router.ts for maintainability.
 */

import { publicProcedure, apiKeyProcedure, router } from '../../trpc';
import { z } from 'zod';
import {
  prisma,
  RentalOrderStatus,
  RentalPaymentStatus,
} from '@sync-erp/database';
import { TRPCError } from '@trpc/server';
import { container, ServiceKeys } from '../../../modules/common/di';
import type { RentalWebhookService } from '../../../modules/rental/rental-webhook.service';
import { webhookService as tenantWebhookService } from '../../../services/webhook.service';

// Lazy resolve webhook service (for admin notifications - Santi Living specific)
const getWebhookService = (): RentalWebhookService | null => {
  try {
    return container.resolve<RentalWebhookService>(
      ServiceKeys.RENTAL_WEBHOOK_SERVICE
    );
  } catch {
    return null;
  }
};

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
    .mutation(async ({ input }) => {
      // Find order by token
      const order = await prisma.rentalOrder.findFirst({
        where: { publicToken: input.token },
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
          orderNumber: true,
          paymentMethod: true,
        },
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
        where: { publicToken: input.token },
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

      // Fire webhook notification to admin (async, non-blocking)
      const webhookService = getWebhookService();
      if (webhookService) {
        webhookService
          .notifyPaymentStatus({
            token: input.token,
            action: 'claimed',
            paymentMethod: input.paymentMethod,
          })
          .catch((err: unknown) => {
            console.error(
              '[PublicRental] Payment claimed webhook failed:',
              err
            );
          });
      }

      // Fire multi-tenant webhook (async, non-blocking)
      tenantWebhookService
        .notifyPaymentEvent(ctx.companyId, 'payment.received', {
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
  confirmPaymentByOrderNumber: publicProcedure
    .input(
      z.object({
        orderNumber: z.string(),
        paymentMethod: z.string(),
        transactionId: z.string().optional(),
        amount: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Find order by order number
      const order = await prisma.rentalOrder.findFirst({
        where: { orderNumber: input.orderNumber },
      });

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // If already confirmed, ignore (idempotency)
      if (
        order.rentalPaymentStatus === RentalPaymentStatus.CONFIRMED
      ) {
        return { success: true, status: 'ALREADY_CONFIRMED' };
      }

      // Update payment status to CONFIRMED (Trusted from Midtrans)
      const updatedOrder = await prisma.rentalOrder.update({
        where: { id: order.id },
        data: {
          rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
          paymentConfirmedAt: new Date(),
          paymentMethod: input.paymentMethod,
          paymentReference: input.transactionId,
        },
      });

      // Fire webhook notification to admin & customer (async, non-blocking)
      const webhookService = getWebhookService();
      if (webhookService && order.publicToken) {
        webhookService
          .notifyPaymentStatus({
            token: order.publicToken,
            action: 'confirmed',
            paymentMethod: input.paymentMethod,
            paymentReference: input.transactionId,
          })
          .catch((err: unknown) => {
            console.error(
              '[PublicRental] Payment confirmed webhook failed:',
              err
            );
          });
      }

      return {
        success: true,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
      };
    }),
});
