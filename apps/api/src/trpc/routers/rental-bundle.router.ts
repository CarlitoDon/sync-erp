import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { prisma } from '@sync-erp/database';
import { TRPCError } from '@trpc/server';

export const rentalBundleRouter = router({
  // List bundles for company
  list: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ input }) => {
      return prisma.rentalBundle.findMany({
        where: { companyId: input.companyId, isActive: true },
        include: {
          components: {
            include: { rentalItem: { include: { product: true } } },
          },
        },
        orderBy: { dailyRate: 'asc' },
      });
    }),

  // Get single bundle by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const bundle = await prisma.rentalBundle.findUnique({
        where: { id: input.id },
        include: {
          components: {
            include: { rentalItem: { include: { product: true } } },
          },
        },
      });

      if (!bundle) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bundle not found',
        });
      }

      return bundle;
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
      const { components, ...bundleData } = input;

      return prisma.rentalBundle.create({
        data: {
          ...bundleData,
          components: components
            ? {
                create: components,
              }
            : undefined,
        },
        include: { components: true },
      });
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
      const { id, ...data } = input;

      return prisma.rentalBundle.update({
        where: { id },
        data,
        include: { components: true },
      });
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
      return prisma.rentalBundle.findUnique({
        where: {
          companyId_externalId: {
            companyId: input.companyId,
            externalId: input.externalId,
          },
        },
        include: { components: true },
      });
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
            includes: z.array(z.string()), // ["kasur busa", "sprei", "bantal", "selimut"]
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const results = [];

      for (const bundle of input.bundles) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { includes, ...bundleData } = bundle;

        const upserted = await prisma.rentalBundle.upsert({
          where: {
            companyId_externalId: {
              companyId: input.companyId,
              externalId: bundle.externalId,
            },
          },
          create: {
            companyId: input.companyId,
            ...bundleData,
            // Components created separately after base rental items exist
          },
          update: {
            name: bundleData.name,
            shortName: bundleData.shortName,
            description: bundleData.description,
            dailyRate: bundleData.dailyRate,
            dimensions: bundleData.dimensions,
            capacity: bundleData.capacity,
            imagePath: bundleData.imagePath,
          },
        });

        results.push(upserted);
      }

      return { synced: results.length, bundles: results };
    }),
});
