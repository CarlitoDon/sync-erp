/**
 * Customer Deposit Router
 *
 * Cash Upfront Sales: tRPC procedures for customer deposit operations.
 */

import { router, protectedProcedure } from '../trpc';
import { CustomerDepositService } from '../../modules/sales/customer-deposit.service';
import {
  RegisterCustomerDepositSchema,
  SettleCustomerDepositSchema,
} from '@sync-erp/shared';
import { z } from 'zod';

const customerDepositService = new CustomerDepositService();

export const customerDepositRouter = router({
  /**
   * Register customer deposit for a Sales Order
   */
  registerDeposit: protectedProcedure
    .input(RegisterCustomerDepositSchema)
    .mutation(async ({ ctx, input }) => {
      return customerDepositService.registerDeposit(
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
   * Get deposit summary for a Sales Order
   */
  getDepositSummary: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return customerDepositService.getDepositSummary(
        ctx.companyId,
        input.orderId
      );
    }),

  /**
   * Get deposit info for an Invoice (for settlement)
   */
  getDepositInfo: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return customerDepositService.getDepositInfo(
        ctx.companyId,
        input.invoiceId
      );
    }),

  /**
   * Settle customer deposit against Invoice AR
   */
  settleDeposit: protectedProcedure
    .input(SettleCustomerDepositSchema)
    .mutation(async ({ ctx, input }) => {
      return customerDepositService.settleDeposit(
        ctx.companyId,
        input.invoiceId,
        ctx.userId
      );
    }),
});

export type CustomerDepositRouter = typeof customerDepositRouter;
