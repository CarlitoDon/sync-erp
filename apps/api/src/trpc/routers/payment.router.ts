import { router, protectedProcedure } from '../trpc';
import { PaymentService } from '../../modules/accounting/services/payment.service';
import {
  CreatePaymentSchema,
  asCorrelationId,
} from '@sync-erp/shared';
import { z } from 'zod';

import { container, ServiceKeys } from '../../modules/common/di';

const paymentService = container.resolve<PaymentService>(
  ServiceKeys.PAYMENT_SERVICE
);

export const paymentRouter = router({
  /**
   * List all payments for current company
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return paymentService.list(ctx.companyId);
  }),

  /**
   * Get payment by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return paymentService.getById(input.id, ctx.companyId);
    }),

  /**
   * Create payment
   * Uses correlationId for idempotency to allow multiple partial payments
   */
  create: protectedProcedure
    .input(CreatePaymentSchema)
    .mutation(async ({ ctx, input }) => {
      return paymentService.create(
        ctx.companyId,
        input,
        input.correlationId
          ? asCorrelationId(input.correlationId)
          : undefined
      );
    }),

  /**
   * Void payment (FR-024: requires reason)
   */
  void: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1, 'Void reason is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return paymentService.void(
        input.id,
        ctx.companyId,
        ctx.userId,
        input.reason,
        ctx.userPermissions // FR-026: Granular RBAC
      );
    }),
});

export type PaymentRouter = typeof paymentRouter;
