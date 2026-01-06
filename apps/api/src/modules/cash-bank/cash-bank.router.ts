import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { CashBankService } from './cash-bank.service';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  createCashTransactionSchema,
  updateCashTransactionSchema,
  voidCashTransactionSchema,
} from '@sync-erp/shared';
import { CashTransactionStatus } from '@sync-erp/database';
import { container, ServiceKeys } from '../common/di';

export const cashBankRouter = router({
  // ===================================
  // Bank Accounts
  // ===================================

  createAccount: protectedProcedure
    .input(createBankAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const service = container.resolve<CashBankService>(
        ServiceKeys.CASH_BANK_SERVICE
      );
      return service.createAccount(ctx.companyId, input);
    }),

  updateAccount: protectedProcedure
    .input(
      z.object({ id: z.string() }).merge(updateBankAccountSchema)
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const service = container.resolve<CashBankService>(
        ServiceKeys.CASH_BANK_SERVICE
      );
      return service.updateAccount(id, ctx.companyId, data);
    }),

  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    const service = container.resolve<CashBankService>(
      ServiceKeys.CASH_BANK_SERVICE
    );
    return service.listAccounts(ctx.companyId);
  }),

  getAccount: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const service = container.resolve<CashBankService>(
        ServiceKeys.CASH_BANK_SERVICE
      );
      return service.getAccount(input, ctx.companyId);
    }),

  // ===================================
  // Transactions
  // ===================================

  createTransaction: protectedProcedure
    .input(createCashTransactionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = container.resolve<CashBankService>(
        ServiceKeys.CASH_BANK_SERVICE
      );
      return service.createTransaction(ctx.companyId, input);
    }),

  updateTransaction: protectedProcedure
    .input(
      z.object({ id: z.string() }).merge(updateCashTransactionSchema)
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const service = container.resolve<CashBankService>(
        ServiceKeys.CASH_BANK_SERVICE
      );
      return service.updateTransaction(id, ctx.companyId, data);
    }),

  postTransaction: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const service = container.resolve<CashBankService>(
        ServiceKeys.CASH_BANK_SERVICE
      );
      return service.postTransaction(
        input,
        ctx.companyId,
        ctx.userId
      );
    }),

  voidTransaction: protectedProcedure
    .input(
      z.object({ id: z.string() }).merge(voidCashTransactionSchema)
    )
    .mutation(async ({ ctx, input }) => {
      const { id, reason } = input;
      const service = container.resolve<CashBankService>(
        ServiceKeys.CASH_BANK_SERVICE
      );
      return service.voidTransaction(
        id,
        ctx.companyId,
        reason,
        ctx.userId
      );
    }),

  listTransactions: protectedProcedure
    .input(
      z.object({
        bankAccountId: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: z.nativeEnum(CashTransactionStatus).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = container.resolve<CashBankService>(
        ServiceKeys.CASH_BANK_SERVICE
      );
      return service.listTransactions(ctx.companyId, input);
    }),

  getTransaction: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const service = container.resolve<CashBankService>(
        ServiceKeys.CASH_BANK_SERVICE
      );
      return service.getTransaction(input, ctx.companyId);
    }),
});
