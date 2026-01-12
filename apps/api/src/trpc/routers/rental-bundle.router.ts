import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { prisma } from '@sync-erp/database';
import { TRPCError } from '@trpc/server';
import { UnitStatus } from '@sync-erp/shared';

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

  // Get component availability for a bundle
  // Returns breakdown of each component with available/required/shortage counts
  getComponentAvailability: protectedProcedure
    .input(
      z.object({
        bundleId: z.string(),
        orderQuantity: z.number().int().positive().default(1),
      })
    )
    .query(async ({ input }) => {
      const bundle = await prisma.rentalBundle.findUnique({
        where: { id: input.bundleId },
        include: {
          components: {
            include: {
              rentalItem: {
                include: {
                  product: true,
                  units: {
                    where: { status: UnitStatus.AVAILABLE },
                  },
                },
              },
            },
          },
        },
      });

      if (!bundle) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bundle not found',
        });
      }

      const components = bundle.components.map((comp) => {
        const requiredQty = comp.quantity * input.orderQuantity;
        const availableQty = comp.rentalItem?.units?.length ?? 0;
        const shortage = Math.max(0, requiredQty - availableQty);

        return {
          rentalItemId: comp.rentalItemId,
          componentLabel: comp.componentLabel,
          productName: comp.rentalItem?.product?.name ?? 'Unknown',
          productSku: comp.rentalItem?.product?.sku ?? '',
          requiredQty,
          availableQty,
          shortage,
          hasShortage: shortage > 0,
        };
      });

      const totalShortage = components.reduce(
        (sum, c) => sum + c.shortage,
        0
      );

      return {
        bundleId: bundle.id,
        bundleName: bundle.name,
        orderQuantity: input.orderQuantity,
        components,
        hasAnyShortage: totalShortage > 0,
        totalShortage,
      };
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
      console.log(
        `[DEBUG findByExternalId] Looking for companyId=${input.companyId}, externalId=${input.externalId}`
      );
      const result = await prisma.rentalBundle.findUnique({
        where: {
          companyId_externalId: {
            companyId: input.companyId,
            externalId: input.externalId,
          },
        },
        include: { components: true },
      });
      console.log(`[DEBUG findByExternalId] Result:`, result);
      return result;
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
        // Separate includes from bundle data
        const { includes, ...bundleData } = bundle;

        // Upsert the main Bundle record
        const upsertedBundle = await prisma.rentalBundle.upsert({
          where: {
            companyId_externalId: {
              companyId: input.companyId,
              externalId: bundle.externalId,
            },
          },
          create: {
            companyId: input.companyId,
            ...bundleData,
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

        // If 'includes' are provided, sync them as components
        if (includes && includes.length > 0) {
          // 1. Clear existing components to avoid duplicates during re-sync
          await prisma.rentalBundleComponent.deleteMany({
            where: { bundleId: upsertedBundle.id },
          });

          // 2. Process each included item
          for (const itemStr of includes) {
            // Parse "2 bantal" -> qty: 2, name: "bantal"
            let quantity = 1;
            let itemName = itemStr;
            const match = itemStr.match(/^(\d+)\s+(.+)$/);
            if (match) {
              quantity = parseInt(match[1], 10);
              itemName = match[2];
            }

            // Find or Create Product
            // Note: In a real app, we might want to be more careful about creating products
            // based on loose strings, but for this sync-service it's required.
            let product = await prisma.product.findFirst({
              where: {
                companyId: input.companyId,
                name: { equals: itemName, mode: 'insensitive' },
              },
            });

            if (!product) {
              product = await prisma.product.create({
                data: {
                  companyId: input.companyId,
                  name: itemName,
                  sku: `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  price: 0,
                },
              });
            }

            // Find or Create RentalItem
            let rentalItem = await prisma.rentalItem.findFirst({
              where: {
                companyId: input.companyId,
                productId: product.id,
              },
            });

            if (!rentalItem) {
              rentalItem = await prisma.rentalItem.create({
                data: {
                  companyId: input.companyId,
                  productId: product.id,
                  dailyRate: 0, // Bundle items usually priced in bundle, but zero here
                  weeklyRate: 0,
                  monthlyRate: 0,
                  depositPolicyType: 'PERCENTAGE', // Default to percentage
                  isActive: true,
                },
              });
            }

            // Create Component Link
            await prisma.rentalBundleComponent.create({
              data: {
                bundleId: upsertedBundle.id,
                rentalItemId: rentalItem.id,
                quantity: quantity,
                componentLabel: itemName,
              },
            });
          }
        }

        results.push(upsertedBundle);
      }

      return { synced: results.length, bundles: results };
    }),
});
