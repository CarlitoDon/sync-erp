import { router, protectedProcedure } from '../trpc';
import { PurchaseOrderService } from '../../modules/procurement/purchase-order.service';
import { IdempotencyScope } from '@sync-erp/database';
import { CreatePurchaseOrderSchema } from '@sync-erp/shared';
import { z } from 'zod';

import { container, ServiceKeys } from '../../modules/common/di';

const purchaseOrderService = container.resolve<PurchaseOrderService>(
  ServiceKeys.PURCHASE_ORDER_SERVICE
);

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
    .meta({ idempotencyScope: IdempotencyScope.ORDER_CREATE })
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
   * Update purchase order
   */
  update: protectedProcedure
    .input(z.object({ id: z.string(), data: z.unknown() }))
    .mutation(async ({ input, ctx }) => {
      return purchaseOrderService.update(
        input.id,
        ctx.companyId,
        input.data
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

  /**
   * Close PO explicitly (Gap 6)
   * Transitions PO to RECEIVED status even if partially received.
   * Requires reason for audit trail.
   */
  close: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1, 'Close reason is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return purchaseOrderService.close(
        input.id,
        ctx.companyId,
        ctx.userId,
        input.reason
      );
    }),

  /**
   * Process a Purchase Return (tRPC layer)
   */
  returnToPo: protectedProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        items: z.array(
          z.object({
            productId: z.string().uuid(),
            quantity: z.number().int().positive(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return purchaseOrderService.returnToPo(
        ctx.companyId,
        input.orderId,
        input.items,
        ctx.userId
      );
    }),
});

export type PurchaseOrderRouter = typeof purchaseOrderRouter;
