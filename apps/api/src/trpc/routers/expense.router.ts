import { router, protectedProcedure } from '../trpc';
import { container, ServiceKeys } from '../../modules/common/di';
import { ExpenseService } from '../../modules/accounting/services/expense.service';
import { z } from 'zod';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

const service = container.resolve<ExpenseService>(
  ServiceKeys.EXPENSE_SERVICE
);

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
      return service.create(ctx.companyId, input);
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return service.list(ctx.companyId);
  }),

  byId: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input, ctx }) => {
      const expense = await service.findById(input, ctx.companyId);
      if (!expense) {
        throw new DomainError(
          'Expense not found',
          404,
          DomainErrorCodes.NOT_FOUND
        );
      }
      return expense;
    }),

  post: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ input, ctx }) => {
      return service.post(input, ctx.companyId);
    }),
});
