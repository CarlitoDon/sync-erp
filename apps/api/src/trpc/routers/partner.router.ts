import { router, protectedProcedure } from '../trpc';
import { PartnerType } from '@sync-erp/database';
import { PartnerService } from '../../modules/partner/partner.service';
import {
  CreatePartnerSchema,
  UpdatePartnerSchema,
} from '@sync-erp/shared';
import { z } from 'zod';

const partnerService = new PartnerService();

export const partnerRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({ type: z.nativeEnum(PartnerType).optional() })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return partnerService.list(ctx.companyId, input?.type);
    }),

  /**
   * Get partner by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return partnerService.getById(input.id, ctx.companyId);
    }),

  /**
   * Create partner
   */
  create: protectedProcedure
    .input(CreatePartnerSchema)
    .mutation(async ({ ctx, input }) => {
      return partnerService.create(ctx.companyId, input);
    }),

  /**
   * Update partner
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: UpdatePartnerSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      return partnerService.update(
        input.id,
        ctx.companyId,
        input.data
      );
    }),

  /**
   * Delete partner
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return partnerService.delete(input.id, ctx.companyId);
    }),
});

export type PartnerRouter = typeof partnerRouter;
