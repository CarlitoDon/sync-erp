import { router, protectedProcedure } from '../trpc';
import { BillService } from '../../modules/accounting/services/bill.service';
import { CreateBillFromPOSchema } from '@sync-erp/shared';
import { z } from 'zod';

const billService = new BillService();

export const billRouter = router({
  /**
   * List all bills for current company
   */
  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return billService.list(ctx.companyId, input?.status);
    }),

  /**
   * Get bill by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return billService.getById(input.id, ctx.companyId);
    }),

  /**
   * Create bill from Purchase Order
   */
  createFromPO: protectedProcedure
    .input(CreateBillFromPOSchema)
    .mutation(async ({ ctx, input }) => {
      return billService.createFromPurchaseOrder(
        ctx.companyId,
        input
      );
    }),

  /**
   * Post bill to ledger
   */
  post: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return billService.post(input.id, ctx.companyId);
    }),

  /**
   * Void bill (FR-024: requires reason)
   */
  void: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1, 'Void reason is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return billService.void(
        input.id,
        ctx.companyId,
        ctx.userId,
        input.reason
      );
    }),
});

export type BillRouter = typeof billRouter;
