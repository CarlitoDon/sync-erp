import { router, protectedProcedure } from '../trpc';
import { ProductService } from '../../modules/product/product.service';
import {
  CreateProductSchema,
  UpdateProductSchema,
} from '@sync-erp/shared';
import { z } from 'zod';

import { container, ServiceKeys } from '../../modules/common/di';

const productService = container.resolve<ProductService>(
  ServiceKeys.PRODUCT_SERVICE
);

export const productRouter = router({
  /**
   * List all products for current company
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return productService.list(ctx.companyId);
  }),

  /**
   * Get product by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return productService.getById(input.id, ctx.companyId);
    }),

  /**
   * Create product
   */
  create: protectedProcedure
    .input(CreateProductSchema)
    .mutation(async ({ ctx, input }) => {
      return productService.create(ctx.companyId, input);
    }),

  /**
   * Update product
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: UpdateProductSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      return productService.update(
        input.id,
        ctx.companyId,
        input.data
      );
    }),

  /**
   * Delete product
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return productService.delete(input.id, ctx.companyId);
    }),
});

export type ProductRouter = typeof productRouter;
