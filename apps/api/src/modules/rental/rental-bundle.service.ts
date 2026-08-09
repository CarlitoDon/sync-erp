/**
 * Rental Bundle Service
 *
 * Business logic for rental bundle management
 */
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { DepositPolicyType } from '@sync-erp/database';
import * as bundleRepo from './rental-bundle.repository';
import { assertBillingFeatureAvailable } from '../billing/billing-limits.service';

export const MAX_CATALOG_BUNDLES = 100;
export const MAX_CATALOG_COMPONENTS_PER_BUNDLE = 100;
export const MAX_CATALOG_COMPONENTS_TOTAL = 500;
export const MAX_CATALOG_COMPONENT_QUANTITY = 1000;

function parseCatalogComponent(itemStr: string) {
  const match = itemStr.match(/^(\d+)\s+(.+)$/);
  if (!match) {
    return { quantity: 1, itemName: itemStr };
  }

  const quantity = Number(match[1]);
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_CATALOG_COMPONENT_QUANTITY
  ) {
    throw new DomainError(
      `A component quantity must be between 1 and ${MAX_CATALOG_COMPONENT_QUANTITY}`,
      400,
      DomainErrorCodes.INVALID_INPUT
    );
  }

  return { quantity, itemName: match[2] };
}

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
  companyId: string;
}

export async function getById(input: GetByIdInput) {
  const bundle = await bundleRepo.findById(input.id, input.companyId);

  if (!bundle) {
    throw new DomainError(
      'Bundle not found',
      404,
      DomainErrorCodes.NOT_FOUND
    );
  }

  return bundle;
}

export interface GetComponentAvailabilityInput {
  bundleId: string;
  companyId: string;
  orderQuantity: number;
}

export async function getComponentAvailability(
  input: GetComponentAvailabilityInput
) {
  const bundle = await bundleRepo.findByIdWithAvailability(
    input.bundleId,
    input.companyId
  );

  if (!bundle) {
    throw new DomainError(
      'Bundle not found',
      404,
      DomainErrorCodes.NOT_FOUND
    );
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
  if (
    input.components &&
    input.components.length > MAX_CATALOG_COMPONENTS_PER_BUNDLE
  ) {
    throw new DomainError(
      `A bundle cannot contain more than ${MAX_CATALOG_COMPONENTS_PER_BUNDLE} components`,
      400,
      DomainErrorCodes.INVALID_INPUT
    );
  }

  if (input.components?.length) {
    const rentalItemIds = input.components.map(
      (component) => component.rentalItemId
    );
    const uniqueRentalItemIds = new Set(rentalItemIds);

    if (uniqueRentalItemIds.size !== rentalItemIds.length) {
      throw new DomainError(
        'A bundle cannot contain duplicate rental items',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  if (input.imagePath) {
    await assertBillingFeatureAvailable({
      companyId: input.companyId,
      feature: 'mediaAccess',
    });
  }

  if (!input.components?.length) {
    return bundleRepo.create(input);
  }

  return bundleRepo.runInTransaction(async (tx) => {
    const rentalItemIds = input.components!.map(
      (component) => component.rentalItemId
    );
    const ownedRentalItems = await bundleRepo.findRentalItemsByIds(
      input.companyId,
      rentalItemIds,
      tx
    );
    if (ownedRentalItems.length !== new Set(rentalItemIds).size) {
      throw new DomainError(
        'One or more rental items do not belong to this company',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    return bundleRepo.create(input, tx);
  });
}

export interface UpdateInput {
  id: string;
  companyId: string;
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
  const { id, companyId, ...data } = input;
  const updated = await bundleRepo.update(id, companyId, data);

  if (!updated) {
    throw new DomainError(
      'Bundle not found',
      404,
      DomainErrorCodes.NOT_FOUND
    );
  }

  return updated;
}

// ============================================
// Sync from an external storefront/catalog.
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

export interface SyncFromExternalCatalogInput {
  companyId: string;
  bundles: SyncBundleItem[];
}

export async function syncFromExternalCatalog(
  input: SyncFromExternalCatalogInput
) {
  if (input.bundles.length > MAX_CATALOG_BUNDLES) {
    throw new DomainError(
      `A catalog sync cannot contain more than ${MAX_CATALOG_BUNDLES} bundles`,
      400,
      DomainErrorCodes.INVALID_INPUT
    );
  }

  if (
    input.bundles.some(
      (bundle) =>
        bundle.includes.length > MAX_CATALOG_COMPONENTS_PER_BUNDLE
    )
  ) {
    throw new DomainError(
      `A bundle cannot contain more than ${MAX_CATALOG_COMPONENTS_PER_BUNDLE} components`,
      400,
      DomainErrorCodes.INVALID_INPUT
    );
  }

  const totalComponents = input.bundles.reduce(
    (total, bundle) => total + bundle.includes.length,
    0
  );
  if (totalComponents > MAX_CATALOG_COMPONENTS_TOTAL) {
    throw new DomainError(
      `A catalog sync cannot contain more than ${MAX_CATALOG_COMPONENTS_TOTAL} components`,
      400,
      DomainErrorCodes.INVALID_INPUT
    );
  }

  for (const bundle of input.bundles) {
    for (const itemStr of bundle.includes) {
      parseCatalogComponent(itemStr);
    }
  }

  if (input.bundles.some((bundle) => Boolean(bundle.imagePath))) {
    await assertBillingFeatureAvailable({
      companyId: input.companyId,
      feature: 'mediaAccess',
    });
  }

  return bundleRepo.runInTransaction(async (tx) => {
    const results = [];

    for (const bundle of input.bundles) {
      const { includes, ...bundleData } = bundle;

      // Upsert the main Bundle record
      const upsertedBundle = await bundleRepo.upsertByExternalId(
        {
          companyId: input.companyId,
          ...bundleData,
        },
        tx
      );

      // Sync components if provided
      if (includes.length > 0) {
        // Clear existing components
        await bundleRepo.deleteComponentsByBundleId(
          upsertedBundle.id,
          tx
        );

        // Process each included item
        for (const itemStr of includes) {
          // Parse "2 bantal" -> qty: 2, name: "bantal"
          const { quantity, itemName } = parseCatalogComponent(itemStr);

          // Find or create Product
          let product = await bundleRepo.findProductByName(
            input.companyId,
            itemName,
            tx
          );

          if (!product) {
            product = await bundleRepo.createProduct(
              {
                companyId: input.companyId,
                name: itemName,
                sku: `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                price: 0,
              },
              tx
            );
          }

          // Find or create RentalItem
          let rentalItem = await bundleRepo.findRentalItemByProductId(
            input.companyId,
            product.id,
            tx
          );

          if (!rentalItem) {
            rentalItem = await bundleRepo.createRentalItem(
              {
                companyId: input.companyId,
                productId: product.id,
                dailyRate: 0,
                weeklyRate: 0,
                monthlyRate: 0,
                depositPolicyType: DepositPolicyType.PERCENTAGE,
                isActive: true,
              },
              tx
            );
          }

          // Create Component Link
          await bundleRepo.createComponent(
            {
              bundleId: upsertedBundle.id,
              rentalItemId: rentalItem.id,
              quantity,
              componentLabel: itemName,
            },
            tx
          );
        }
      }

      results.push(upsertedBundle);
    }

    return { synced: results.length, bundles: results };
  });
}
