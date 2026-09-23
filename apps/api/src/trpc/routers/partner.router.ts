import { router, protectedProcedure } from '../trpc';
import { PartnerType } from '@sync-erp/database';
import { PartnerService } from '../../modules/partner/partner.service';
import {
  CreatePartnerSchema,
  UpdatePartnerSchema,
  MergePartnersSchema,
  CreateAddressInputSchema,
  AddressListQuerySchema,
} from '@sync-erp/shared';
import { z } from 'zod';

import { container, ServiceKeys } from '../../modules/common/di';

const partnerService = container.resolve<PartnerService>(
  ServiceKeys.PARTNER_SERVICE
);

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

  /**
   * Merge duplicate partners into target partner
   */
  merge: protectedProcedure
    .input(MergePartnersSchema)
    .mutation(async ({ ctx, input }) => {
      return partnerService.merge(
        ctx.companyId,
        input.targetPartnerId,
        input.sourcePartnerIds
      );
    }),

  /**
   * List partner addresses
   */
  listAddresses: protectedProcedure
    .input(AddressListQuerySchema)
    .query(async ({ ctx, input }) => {
      return partnerService.listAddresses(input.partnerId, ctx.companyId);
    }),

  /**
   * Create new address for partner
   */
  createAddress: protectedProcedure
    .input(CreateAddressInputSchema)
    .mutation(async ({ ctx, input }) => {
      return partnerService.createAddress(ctx.companyId, input);
    }),

  /**
   * Set default address for partner
   */
  setDefaultAddress: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        partnerId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return partnerService.setDefaultAddress(
        input.id,
        input.partnerId,
        ctx.companyId
      );
    }),

  /**
   * Delete address
   */
  deleteAddress: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return partnerService.deleteAddress(input.id, ctx.companyId);
    }),
});

export type PartnerRouter = typeof partnerRouter;
