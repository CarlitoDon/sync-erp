import { DepositPolicyType, prisma } from '@sync-erp/database';

export interface SyncBundleItem {
  externalId: string;
  name: string;
  shortName?: string;
  description?: string;
  dailyRate: number;
  dimensions?: string;
  capacity?: string;
  imagePath?: string;
  includes: string[]; // ["2 bantal", "kasur busa", etc.]
}

export interface SyncFromSantiLivingInput {
  companyId: string;
  bundles: SyncBundleItem[];
}

export async function syncFromSantiLiving(
  input: SyncFromSantiLivingInput
) {
  const results = [];

  for (const bundle of input.bundles) {
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
        ...bundleData,
      },
    });

    // Sync components if provided
    if (includes && includes.length > 0) {
      // Clear existing components
      await prisma.rentalBundleComponent.deleteMany({
        where: { bundleId: upsertedBundle.id },
      });

      // Process each included item
      for (const itemStr of includes) {
        // Parse "2 bantal" -> qty: 2, name: "bantal"
        let quantity = 1;
        let itemName = itemStr;
        const match = itemStr.match(/^(\d+)\s+(.+)$/);
        if (match) {
          quantity = parseInt(match[1], 10);
          itemName = match[2];
        }

        // Find or create Product
        let product = await prisma.product.findFirst({
          where: { companyId: input.companyId, name: itemName },
        });

        if (!product) {
          product = await prisma.product.create({
            data: {
              companyId: input.companyId,
              name: itemName,
              sku: `SL-${itemName.toLowerCase().replace(/\s+/g, '-')}`,
              price: 0,
            },
          });
        }

        // Find or create RentalItem
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
              dailyRate: 0,
              weeklyRate: 0,
              monthlyRate: 0,
              depositPolicyType: DepositPolicyType.PERCENTAGE,
              isActive: true,
            },
          });
        }

        // Create Component Link
        await prisma.rentalBundleComponent.create({
          data: {
            bundleId: upsertedBundle.id,
            rentalItemId: rentalItem.id,
            quantity,
            componentLabel: itemName,
          },
        });
      }
    }

    results.push(upsertedBundle);
  }

  return { synced: results.length, bundles: results };
}
