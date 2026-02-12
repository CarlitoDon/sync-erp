import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import * as bundleService from '../../modules/rental/rental-bundle.service';

export const rentalBundleRouter = router({
  // List bundles for company
  list: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ input }) => {
      return bundleService.list({ companyId: input.companyId });
    }),

  // Get component availability for a bundle
  getComponentAvailability: protectedProcedure
    .input(
      z.object({
        bundleId: z.string(),
        orderQuantity: z.number().int().positive().default(1),
      })
    )
    .query(async ({ input, ctx }) => {
      return bundleService.getComponentAvailability({
        bundleId: input.bundleId,
        companyId: ctx.companyId,
        orderQuantity: input.orderQuantity,
      });
    }),

  // Get single bundle by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return bundleService.getById({ id: input.id, companyId: ctx.companyId });
    }),

  // Create bundle
  create: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        externalId: z.string().optional(),
        name: z.string().min(2),
        shortName: z.string().optional(),
        description: z.string().optional(),
        dailyRate: z.number().positive(),
        weeklyRate: z.number().optional(),
        monthlyRate: z.number().optional(),
        dimensions: z.string().optional(),
        capacity: z.string().optional(),
        imagePath: z.string().optional(),
        components: z
          .array(
            z.object({
              rentalItemId: z.string(),
              quantity: z.number().int().positive().default(1),
              componentLabel: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      return bundleService.create(input);
    }),

  // Update bundle
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        shortName: z.string().optional(),
        description: z.string().optional(),
        dailyRate: z.number().positive().optional(),
        weeklyRate: z.number().optional(),
        monthlyRate: z.number().optional(),
        dimensions: z.string().optional(),
        capacity: z.string().optional(),
        imagePath: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return bundleService.update(input);
    }),

  // Find by external ID (for santi-living integration)
  findByExternalId: publicProcedure
    .input(
      z.object({
        companyId: z.string(),
        externalId: z.string(),
      })
    )
    .query(async ({ input }) => {
      return bundleService.findByExternalId(input);
    }),

  // Sync bundles from santi-living products.json
  syncFromSantiLiving: publicProcedure
    .input(
      z.object({
        companyId: z.string(),
        bundles: z.array(
          z.object({
            externalId: z.string(),
            name: z.string(),
            shortName: z.string().optional(),
            description: z.string().optional(),
            dailyRate: z.number(),
            dimensions: z.string().optional(),
            capacity: z.string().optional(),
            imagePath: z.string().optional(),
            includes: z.array(z.string()),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      return bundleService.syncFromSantiLiving(input);
    }),
});
