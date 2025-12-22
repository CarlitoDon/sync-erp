import { router, protectedProcedure } from '../trpc';
import { PurchaseOrderService } from '../../modules/procurement/purchase-order.service';
import { CreatePurchaseOrderSchema } from '@sync-erp/shared';
import { z } from 'zod';

const purchaseOrderService = new PurchaseOrderService();

export const purchaseOrderRouter = router({
  /**
   * List all purchase orders for current company
   */
  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return purchaseOrderService.list(ctx.companyId, input?.status);
    }),

  /**
   * Get purchase order by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return purchaseOrderService.getById(input.id, ctx.companyId);
    }),

  /**
   * Create purchase order
   */
  create: protectedProcedure
    .input(CreatePurchaseOrderSchema)
    .mutation(async ({ ctx, input }) => {
      return purchaseOrderService.create(
        ctx.companyId,
        input,
        undefined, // businessDate
        ctx.userId
      );
    }),

  /**
   * Confirm purchase order
   */
  confirm: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return purchaseOrderService.confirm(
        input.id,
        ctx.companyId,
        ctx.userId
      );
    }),

  /**
   * Cancel purchase order
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return purchaseOrderService.cancel(
        input.id,
        ctx.companyId,
        ctx.userId
      );
    }),

  /**
   * Get already received quantities for a PO
   * Used by GoodsReceiptModal to show remaining qty to receive
   */
  getReceivedQuantities: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ input }) => {
      const receivedMap =
        await purchaseOrderService.getReceivedQuantities(
          input.orderId
        );
      // Convert Map to array of [productId, quantity] for JSON serialization
      return Array.from(receivedMap.entries());
    }),
});

export type PurchaseOrderRouter = typeof purchaseOrderRouter;
