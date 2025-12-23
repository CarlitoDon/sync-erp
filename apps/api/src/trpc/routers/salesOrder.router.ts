import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { SalesOrderService } from '../../modules/sales/sales-order.service';
import { CreateSalesOrderSchema } from '@sync-erp/shared';

const salesOrderService = new SalesOrderService();

export const salesOrderRouter = router({
  /**
   * List all sales orders for current company
   */
  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return salesOrderService.list(ctx.companyId, input?.status);
    }),

  /**
   * Get sales order by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return salesOrderService.getById(input.id, ctx.companyId);
    }),

  /**
   * Create sales order
   */
  create: protectedProcedure
    .input(CreateSalesOrderSchema)
    .mutation(async ({ ctx, input }) => {
      return salesOrderService.create(
        ctx.companyId,
        input,
        undefined, // shape
        ctx.userId
      );
    }),

  /**
   * Update sales order
   */
  update: protectedProcedure
    .input(z.object({ id: z.string(), data: z.any() }))
    .mutation(async ({ input, ctx }) => {
      return salesOrderService.update(
        input.id,
        ctx.companyId,
        input.data
      );
    }),

  /**
   * Confirm sales order
   */
  confirm: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return salesOrderService.confirm(
        input.id,
        ctx.companyId,
        ctx.userId
      );
    }),

  /**
   * Ship/Deliver Order
   */
  ship: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reference: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return salesOrderService.ship(
        ctx.companyId,
        input.id,
        input.reference
      );
    }),

  /**
   * Cancel sales order
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return salesOrderService.cancel(
        input.id,
        ctx.companyId,
        ctx.userId
      );
    }),

  /**
   * Get already shipped quantities for a SO
   * Used by ShipmentModal to show remaining qty to ship
   */
  getShippedQuantities: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ input }) => {
      const shippedMap = await salesOrderService.getShippedQuantities(
        input.orderId
      );
      // Convert Map to array of [productId, quantity] for JSON serialization
      return Array.from(shippedMap.entries());
    }),
});

export type SalesOrderRouter = typeof salesOrderRouter;
