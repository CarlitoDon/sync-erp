import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { ExpenseService } from '../../modules/accounting/services/expense.service';
import { TRPCError } from '@trpc/server';
import { DomainError } from '@sync-erp/shared';

const service = new ExpenseService();

export const expenseRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        partnerId: z.string().uuid(),
        date: z.date(),
        dueDate: z.date().optional(),
        reference: z.string().optional(),
        items: z
          .array(
            z.object({
              productId: z.string().uuid().optional(),
              description: z.string().min(1),
              quantity: z.number().min(1),
              price: z.number().min(0),
            })
          )
          .min(1),
        taxRate: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await service.create(ctx.companyId, input);
      } catch (error) {
        if (error instanceof DomainError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return service.list(ctx.companyId);
  }),

  byId: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input, ctx }) => {
      const expense = await service.findById(input, ctx.companyId);
      if (!expense) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Expense not found',
        });
      }
      return expense;
    }),

  post: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ input, ctx }) => {
      try {
        return await service.post(input, ctx.companyId);
      } catch (error) {
        if (error instanceof DomainError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }),
});
