import { router, protectedProcedure } from '../trpc';
import { SalesService } from '../../modules/sales/sales.service';
import { CreateSalesOrderSchema } from '@sync-erp/shared';
import { z } from 'zod';

const salesService = new SalesService();

export const salesOrderRouter = router({
  /**
   * List all sales orders for current company
   */
  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return salesService.list(ctx.companyId, input?.status);
    }),

  /**
   * Get sales order by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return salesService.getById(input.id, ctx.companyId);
    }),

  /**
   * Create sales order
   */
  create: protectedProcedure
    .input(CreateSalesOrderSchema)
    .mutation(async ({ ctx, input }) => {
      return salesService.create(ctx.companyId, input);
    }),

  /**
   * Confirm sales order
   */
  confirm: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return salesService.confirm(input.id, ctx.companyId);
    }),

  /**
   * Cancel sales order
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return salesService.cancel(input.id, ctx.companyId);
    }),
});

export type SalesOrderRouter = typeof salesOrderRouter;
