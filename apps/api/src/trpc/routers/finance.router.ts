import { router, protectedProcedure } from '../trpc';
import { AccountService } from '../../modules/accounting/services/account.service';
import { JournalService } from '../../modules/accounting/services/journal.service';
import { ReportService } from '../../modules/accounting/services/report.service';
import {
  CreateAccountSchema,
  CreateJournalSchema,
} from '@sync-erp/shared';
import { z } from 'zod';

const accountService = new AccountService();
const journalService = new JournalService();
const reportService = new ReportService();

export const financeRouter = router({
  /**
   * List all accounts
   */
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    return accountService.list(ctx.companyId!);
  }),

  /**
   * Create new account
   */
  createAccount: protectedProcedure
    .input(CreateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      return accountService.create(ctx.companyId!, input);
    }),

  /**
   * Seed default chart of accounts
   */
  seedAccounts: protectedProcedure.mutation(async ({ ctx }) => {
    return accountService.seedDefaultAccounts(ctx.companyId!);
  }),

  /**
   * List journal entries
   */
  listJournals: protectedProcedure
    .input(
      z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const startDate = input?.startDate
        ? new Date(input.startDate)
        : undefined;
      const endDate = input?.endDate
        ? new Date(input.endDate)
        : undefined;
      return journalService.list(ctx.companyId!, startDate, endDate);
    }),

  /**
   * Get journal entry by ID
   */
  getJournalById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return journalService.getById(input.id, ctx.companyId!);
    }),

  /**
   * Create journal entry
   */
  createJournal: protectedProcedure
    .input(CreateJournalSchema)
    .mutation(async ({ ctx, input }) => {
      return journalService.create(ctx.companyId!, input);
    }),

  /**
   * Get trial balance report
   */
  getTrialBalance: protectedProcedure
    .input(
      z
        .object({
          date: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const date = input?.date ? new Date(input.date) : new Date();
      return reportService.getTrialBalance(ctx.companyId!, date);
    }),

  /**
   * Get general ledger report
   */
  getGeneralLedger: protectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = input.startDate
        ? new Date(input.startDate)
        : undefined;
      const endDate = input.endDate
        ? new Date(input.endDate)
        : undefined;
      return reportService.getGeneralLedger(
        ctx.companyId!,
        input.accountId,
        startDate,
        endDate
      );
    }),

  /**
   * Get income statement report
   */
  getIncomeStatement: protectedProcedure
    .input(
      z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const startDate = input?.startDate
        ? new Date(input.startDate)
        : new Date(new Date().getFullYear(), 0, 1);
      const endDate = input?.endDate
        ? new Date(input.endDate)
        : new Date();
      return reportService.getIncomeStatement(
        ctx.companyId!,
        startDate,
        endDate
      );
    }),
});

export type FinanceRouter = typeof financeRouter;
