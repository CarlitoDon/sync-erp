/**
 * Upfront Payment Router
 *
 * Feature 036: tRPC procedures for upfront payment operations.
 */

import { router, protectedProcedure } from '../trpc';
import { UpfrontPaymentService } from '../../modules/procurement/upfront-payment.service';
import {
  RegisterUpfrontPaymentSchema,
  SettlePrepaidSchema,
} from '@sync-erp/shared';
import { z } from 'zod';

import { container, ServiceKeys } from '../../modules/common/di';

const upfrontPaymentService =
  container.resolve<UpfrontPaymentService>(
    ServiceKeys.UPFRONT_PAYMENT_SERVICE
  );

export const upfrontPaymentRouter = router({
  /**
   * T035: Register upfront payment for a PO
   */
  registerPayment: protectedProcedure
    .input(RegisterUpfrontPaymentSchema)
    .mutation(async ({ ctx, input }) => {
      return upfrontPaymentService.registerPayment(
        ctx.companyId,
        {
          orderId: input.orderId,
          amount: input.amount,
          method: input.method,
          accountId: input.accountId,
          reference: input.reference,
          businessDate: input.businessDate,
        },
        ctx.userId
      );
    }),

  /**
   * Get payment summary for a PO
   */
  getPaymentSummary: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return upfrontPaymentService.getPaymentSummary(
        ctx.companyId,
        input.orderId
      );
    }),

  /**
   * Get prepaid info for a Bill (for settlement)
   */
  getPrepaidInfo: protectedProcedure
    .input(z.object({ billId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return upfrontPaymentService.getPrepaidInfo(
        ctx.companyId,
        input.billId
      );
    }),

  /**
   * T036: Settle prepaid against Bill AP
   */
  settlePrepaid: protectedProcedure
    .input(SettlePrepaidSchema)
    .mutation(async ({ ctx, input }) => {
      return upfrontPaymentService.settlePrepaid(
        ctx.companyId,
        input.billId,
        ctx.userId
      );
    }),
});

export type UpfrontPaymentRouter = typeof upfrontPaymentRouter;
