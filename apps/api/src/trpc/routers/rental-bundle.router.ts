import { z } from 'zod';
import {
  apiKeyProcedure,
  protectedProcedure,
  requirePermission,
  router,
} from '../trpc';
import * as bundleService from '../../modules/rental/rental-bundle.service';
import { assertBillingFeatureAvailable } from '../../modules/billing/billing-limits.service';

const emptyInput = z.object({});

const rentalCatalogReadProcedure = apiKeyProcedure.use(
  requirePermission('rental:read')
);
const rentalCatalogWriteProcedure = apiKeyProcedure.use(
  requirePermission('rental:write')
);

const bundleComponentInput = z.object({
  rentalItemId: z.string().min(1).max(100),
  quantity: z
    .number()
    .int()
    .positive()
    .max(bundleService.MAX_CATALOG_COMPONENT_QUANTITY)
    .default(1),
  componentLabel: z.string().min(1).max(200),
});

const externalCatalogBundleInput = z.object({
  externalId: z.string().min(1).max(200),
  name: z.string().min(2).max(200),
  shortName: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  dailyRate: z.number().finite().nonnegative(),
  dimensions: z.string().max(200).optional(),
  capacity: z.string().max(200).optional(),
  imagePath: z.string().max(2048).optional(),
  includes: z
    .array(z.string().min(1).max(200))
    .max(bundleService.MAX_CATALOG_COMPONENTS_PER_BUNDLE),
});

export const rentalBundleRouter = router({
  // List bundles for company
  list: protectedProcedure
    .input(emptyInput)
    .query(async ({ ctx }) => {
      return bundleService.list({ companyId: ctx.companyId });
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
        externalId: z.string().min(1).max(200).optional(),
        name: z.string().min(2).max(200),
        shortName: z.string().max(200).optional(),
        description: z.string().max(5000).optional(),
        dailyRate: z.number().positive().finite(),
        weeklyRate: z.number().finite().nonnegative().optional(),
        monthlyRate: z.number().finite().nonnegative().optional(),
        dimensions: z.string().max(200).optional(),
        capacity: z.string().max(200).optional(),
        imagePath: z.string().max(2048).optional(),
        components: z
          .array(bundleComponentInput)
          .max(bundleService.MAX_CATALOG_COMPONENTS_PER_BUNDLE)
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return bundleService.create({
        ...input,
        companyId: ctx.companyId,
      });
    }),

  // Update bundle
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).max(200).optional(),
        shortName: z.string().max(200).optional(),
        description: z.string().max(5000).optional(),
        dailyRate: z.number().positive().finite().optional(),
        weeklyRate: z.number().finite().nonnegative().optional(),
        monthlyRate: z.number().finite().nonnegative().optional(),
        dimensions: z.string().max(200).optional(),
        capacity: z.string().max(200).optional(),
        imagePath: z.string().max(2048).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.imagePath) {
        await assertBillingFeatureAvailable({
          companyId: ctx.companyId,
          feature: 'mediaAccess',
        });
      }

      return bundleService.update({
        ...input,
        companyId: ctx.companyId,
      });
    }),

  // Find by external catalog ID.
  findByExternalId: rentalCatalogReadProcedure
    .input(z.object({ externalId: z.string().min(1).max(200) }))
    .query(async ({ input, ctx }) => {
      return bundleService.findByExternalId({
        companyId: ctx.companyId,
        externalId: input.externalId,
      });
    }),

  // Sync bundles from an external catalog payload.
  syncFromExternalCatalog: rentalCatalogWriteProcedure
    .input(
      z.object({
        bundles: z
          .array(externalCatalogBundleInput)
          .max(bundleService.MAX_CATALOG_BUNDLES),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return bundleService.syncFromExternalCatalog({
        companyId: ctx.companyId,
        bundles: input.bundles,
      });
    }),
});
