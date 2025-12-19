import { router, protectedProcedure } from '../trpc';
import { InventoryService } from '../../modules/inventory/inventory.service';
import {
  CreateGoodsReceiptSchema,
  CreateShipmentSchema,
} from '@sync-erp/shared';
import { z } from 'zod';

const inventoryService = new InventoryService();

export const inventoryRouter = router({
  /**
   * List all inventory movements
   */
  getMovements: protectedProcedure
    .input(
      z.object({ productId: z.string().uuid().optional() }).optional()
    )
    .query(async ({ ctx, input }) => {
      return inventoryService.getMovements(
        ctx.companyId!,
        input?.productId
      );
    }),

  /**
   * Get stock levels for all products
   */
  getStockLevels: protectedProcedure.query(async ({ ctx }) => {
    return inventoryService.getStockLevels(ctx.companyId!);
  }),

  /**
   * List all Goods Receipt Notes
   */
  listGRN: protectedProcedure.query(async ({ ctx }) => {
    return inventoryService.listGRN(ctx.companyId!);
  }),

  /**
   * Get GRN by ID
   */
  getGRN: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return inventoryService.getGRN(ctx.companyId!, input.id);
    }),

  /**
   * Create Goods Receipt Note
   */
  createGRN: protectedProcedure
    .input(CreateGoodsReceiptSchema)
    .mutation(async ({ ctx, input }) => {
      return inventoryService.createGRN(ctx.companyId!, input);
    }),

  /**
   * Post GRN (process stock in)
   */
  postGRN: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return inventoryService.postGRN(ctx.companyId!, input.id);
    }),

  /**
   * List all Shipments
   */
  listShipments: protectedProcedure.query(async ({ ctx }) => {
    return inventoryService.listShipments(ctx.companyId!);
  }),

  /**
   * Get Shipment by ID
   */
  getShipment: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return inventoryService.getShipment(ctx.companyId!, input.id);
    }),

  /**
   * Create Shipment
   */
  createShipment: protectedProcedure
    .input(CreateShipmentSchema)
    .mutation(async ({ ctx, input }) => {
      return inventoryService.createShipment(ctx.companyId!, input);
    }),

  /**
   * Post Shipment (process stock out)
   */
  postShipment: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return inventoryService.postShipment(ctx.companyId!, input.id);
    }),
});

export type InventoryRouter = typeof inventoryRouter;
