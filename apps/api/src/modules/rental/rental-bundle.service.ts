/**
 * Rental Bundle Service
 *
 * Business logic for rental bundle management
 */
import { TRPCError } from '@trpc/server';
import { DepositPolicyType } from '@sync-erp/database';
import * as bundleRepo from './rental-bundle.repository';

// ============================================
// Queries
// ============================================

export interface ListInput {
  companyId: string;
}

export async function list(input: ListInput) {
  return bundleRepo.findMany(input.companyId);
}

export interface GetByIdInput {
  id: string;
}

export async function getById(input: GetByIdInput) {
  const bundle = await bundleRepo.findById(input.id);

  if (!bundle) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Bundle not found',
    });
  }

  return bundle;
}

export interface GetComponentAvailabilityInput {
  bundleId: string;
  orderQuantity: number;
}

export async function getComponentAvailability(
  input: GetComponentAvailabilityInput
) {
  const bundle = await bundleRepo.findByIdWithAvailability(
    input.bundleId
  );

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
}

export interface FindByExternalIdInput {
  companyId: string;
  externalId: string;
}

export async function findByExternalId(input: FindByExternalIdInput) {
  return bundleRepo.findByExternalId(
    input.companyId,
    input.externalId
  );
}

// ============================================
// Commands
// ============================================

export interface CreateInput {
  companyId: string;
  externalId?: string;
  name: string;
  shortName?: string;
  description?: string;
  dailyRate: number;
  weeklyRate?: number;
  monthlyRate?: number;
  dimensions?: string;
  capacity?: string;
  imagePath?: string;
  components?: Array<{
    rentalItemId: string;
    quantity: number;
    componentLabel: string;
  }>;
}

export async function create(input: CreateInput) {
  return bundleRepo.create(input);
}

export interface UpdateInput {
  id: string;
  name?: string;
  shortName?: string;
  description?: string;
  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  dimensions?: string;
  capacity?: string;
  imagePath?: string;
  isActive?: boolean;
}

export async function update(input: UpdateInput) {
  const { id, ...data } = input;
  return bundleRepo.update(id, data);
}

// ============================================
// Sync from Santi Living
// ============================================

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
    const upsertedBundle = await bundleRepo.upsertByExternalId({
      companyId: input.companyId,
      ...bundleData,
    });

    // Sync components if provided
    if (includes && includes.length > 0) {
      // Clear existing components
      await bundleRepo.deleteComponentsByBundleId(upsertedBundle.id);

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
        let product = await bundleRepo.findProductByName(
          input.companyId,
          itemName
        );

        if (!product) {
          product = await bundleRepo.createProduct({
            companyId: input.companyId,
            name: itemName,
            sku: `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            price: 0,
          });
        }

        // Find or create RentalItem
        let rentalItem = await bundleRepo.findRentalItemByProductId(
          input.companyId,
          product.id
        );

        if (!rentalItem) {
          rentalItem = await bundleRepo.createRentalItem({
            companyId: input.companyId,
            productId: product.id,
            dailyRate: 0,
            weeklyRate: 0,
            monthlyRate: 0,
            depositPolicyType: DepositPolicyType.PERCENTAGE,
            isActive: true,
          });
        }

        // Create Component Link
        await bundleRepo.createComponent({
          bundleId: upsertedBundle.id,
          rentalItemId: rentalItem.id,
          quantity,
          componentLabel: itemName,
        });
      }
    }

    results.push(upsertedBundle);
  }

  return { synced: results.length, bundles: results };
}
