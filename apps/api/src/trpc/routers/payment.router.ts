import { router, protectedProcedure } from '../trpc';
import { PaymentService } from '../../modules/accounting/services/payment.service';
import { CreatePaymentSchema } from '@sync-erp/shared';
import { z } from 'zod';

const paymentService = new PaymentService();

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
   */
  create: protectedProcedure
    .input(CreatePaymentSchema)
    .mutation(async ({ ctx, input }) => {
      return paymentService.create(ctx.companyId, input, ctx.userId);
    }),
});

export type PaymentRouter = typeof paymentRouter;
