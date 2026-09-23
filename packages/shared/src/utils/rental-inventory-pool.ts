/**
 * Rental Inventory Pool & Mattress Services Allocator
 *
 * Core domain utility to calculate cross-bundle and standalone item inventory demand,
 * prevent overbooking of shared physical components, calculate dynamic remaining capacity per line,
 * and enforce mattress-based logistics service caps.
 */

export interface RentalOrderItemLike {
  type?: 'item' | 'bundle';
  rentalItemId?: string | null;
  rentalBundleId?: string | null;
  quantity: number | string;
  pricePerDay?: number | null;
}

export interface PoolRentalItem {
  id: string;
  product?: { name?: string | null } | null;
  category?: { name?: string | null } | null;
  units?: Array<{ status?: string | null }> | null;
}

export interface PoolBundleComponent {
  rentalItemId: string;
  quantity: number;
  componentLabel?: string | null;
  rentalItem?: PoolRentalItem | null;
}

export interface PoolRentalBundle {
  id: string;
  name: string;
  components?: PoolBundleComponent[] | null;
}

export interface DemandBreakdown {
  source: 'item' | 'bundle';
  label: string;
  quantity: number;
}

export interface StockConflict {
  rentalItemId: string;
  itemName: string;
  totalRequired: number;
  totalAvailable: number;
  shortage: number;
  breakdown: DemandBreakdown[];
  message: string;
}

export interface CrossInventoryDemandResult {
  demandMap: Record<string, number>;
  conflicts: StockConflict[];
  hasConflict: boolean;
}

/**
 * Checks whether an item or component is a mattress ("kasur").
 * Explicitly excludes accessories like sheets, pillows, covers, or protectors even if they mention "kasur".
 */
export function isMattress(info: {
  categoryName?: string | null;
  productName?: string | null;
  label?: string | null;
}): boolean {
  // If category is explicitly non-mattress (e.g. sprei, bantal, aksesoris, linen), reject
  if (
    info.categoryName &&
    /sprei|bedsheet|bantal|pillow|guling|selimut|blanket|aksesoris|linen/i.test(
      info.categoryName
    )
  ) {
    return false;
  }

  // If product name or label explicitly indicates an accessory / linen even if it mentions "kasur" (e.g. "Sprei Kasur", "Sarung Kasur", "Pelindung Kasur")
  const accessoryRegex =
    /^(?:sprei|bedsheet|sarung|cover|pelindung|protector)\b/i;
  if (
    (info.productName && accessoryRegex.test(info.productName)) ||
    (info.label && accessoryRegex.test(info.label))
  ) {
    return false;
  }

  const fields = [info.categoryName, info.productName, info.label];
  return fields.some(
    (field) =>
      typeof field === 'string' &&
      /kasur|mattress|matras|springbed|spring\s*bed/i.test(field)
  );
}

/**
 * Calculates the total number of physical mattresses in an order across standalone items and bundles.
 */
export function calculateTotalMattressesInOrder(
  items: RentalOrderItemLike[],
  rentalItems: PoolRentalItem[],
  rentalBundles: PoolRentalBundle[]
): number {
  let total = 0;

  for (const item of items) {
    const qty =
      typeof item.quantity === 'number'
        ? item.quantity
        : parseInt(String(item.quantity), 10);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const isBundle =
      item.type === 'bundle' ||
      (!item.rentalItemId && Boolean(item.rentalBundleId));

    if (isBundle && item.rentalBundleId) {
      const bundle = rentalBundles.find((b) => b.id === item.rentalBundleId);
      if (bundle) {
        const mattressComponents = (bundle.components || []).filter((c) => {
          const ri =
            c.rentalItem || rentalItems.find((r) => r.id === c.rentalItemId);
          return isMattress({
            label: c.componentLabel,
            productName: ri?.product?.name,
            categoryName: ri?.category?.name,
          });
        });

        if (mattressComponents.length > 0) {
          const mattressPerBundle = mattressComponents.reduce(
            (acc, c) => acc + (c.quantity || 1),
            0
          );
          total += qty * mattressPerBundle;
        } else if (
          /paket|kasur|mattress|springbed|spring\s*bed/i.test(bundle.name)
        ) {
          // Standard rental mattress package defaults to 1 mattress per package if components unpopulated
          total += qty * 1;
        }
      }
    } else if (item.rentalItemId) {
      const ri = rentalItems.find((r) => r.id === item.rentalItemId);
      if (
        ri &&
        isMattress({
          categoryName: ri.category?.name,
          productName: ri.product?.name,
        })
      ) {
        total += qty;
      }
    }
  }

  return total;
}

export interface CalculateCrossInventoryDemandParams {
  items: RentalOrderItemLike[];
  rentalItems: PoolRentalItem[];
  rentalBundles: PoolRentalBundle[];
  availabilityMap?: Record<string, number> | null;
  getAvailableUnits?: (rentalItemId: string) => number;
}

/**
 * Calculates aggregate physical inventory demand from standalone items and bundle components,
 * and checks for overstock conflicts against available warehouse stock.
 */
export function calculateCrossInventoryDemand({
  items,
  rentalItems,
  rentalBundles,
  availabilityMap,
  getAvailableUnits,
}: CalculateCrossInventoryDemandParams): CrossInventoryDemandResult {
  const demandMap: Record<string, number> = {};
  const breakdownMap: Record<string, DemandBreakdown[]> = {};

  const resolveAvailable = (rentalItemId: string): number => {
    if (getAvailableUnits) {
      return getAvailableUnits(rentalItemId);
    }
    if (availabilityMap && typeof availabilityMap[rentalItemId] === 'number') {
      return availabilityMap[rentalItemId];
    }
    const item = rentalItems.find((ri) => ri.id === rentalItemId);
    if (item?.units) {
      return item.units.filter(
        (u) => u.status !== 'MAINTENANCE' && u.status !== 'RETIRED'
      ).length;
    }
    return 0;
  };

  for (const item of items) {
    const qty =
      typeof item.quantity === 'number'
        ? item.quantity
        : parseInt(String(item.quantity), 10);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const isBundle =
      item.type === 'bundle' ||
      (!item.rentalItemId && Boolean(item.rentalBundleId));

    if (isBundle && item.rentalBundleId) {
      const bundle = rentalBundles.find((b) => b.id === item.rentalBundleId);
      if (bundle && bundle.components) {
        for (const comp of bundle.components) {
          const compItemId = comp.rentalItemId;
          const compQty = (comp.quantity || 1) * qty;
          demandMap[compItemId] = (demandMap[compItemId] || 0) + compQty;

          if (!breakdownMap[compItemId]) {
            breakdownMap[compItemId] = [];
          }
          breakdownMap[compItemId].push({
            source: 'bundle',
            label: `${bundle.name} (${qty}x)`,
            quantity: compQty,
          });
        }
      }
    } else if (item.rentalItemId) {
      const itemId = item.rentalItemId;
      demandMap[itemId] = (demandMap[itemId] || 0) + qty;

      if (!breakdownMap[itemId]) {
        breakdownMap[itemId] = [];
      }
      const ri = rentalItems.find((r) => r.id === itemId);
      const name = ri?.product?.name || 'Item Ekstra';
      breakdownMap[itemId].push({
        source: 'item',
        label: `${name} (${qty} unit)`,
        quantity: qty,
      });
    }
  }

  const conflicts: StockConflict[] = [];

  for (const [rentalItemId, totalRequired] of Object.entries(demandMap)) {
    const totalAvailable = resolveAvailable(rentalItemId);
    if (totalRequired > totalAvailable) {
      const ri = rentalItems.find((r) => r.id === rentalItemId);
      const itemName = ri?.product?.name || 'Item';
      const shortage = totalRequired - totalAvailable;
      const breakdowns = breakdownMap[rentalItemId] || [];
      const breakdownDesc = breakdowns
        .map((b) => `${b.quantity} dari ${b.label}`)
        .join(', ');

      conflicts.push({
        rentalItemId,
        itemName,
        totalRequired,
        totalAvailable,
        shortage,
        breakdown: breakdowns,
        message: `Stok tidak mencukupi untuk "${itemName}". Total kebutuhan: ${totalRequired} (${breakdownDesc}), tetapi stok tersedia hanya ${totalAvailable} unit (kurang ${shortage} unit).`,
      });
    }
  }

  return {
    demandMap,
    conflicts,
    hasConflict: conflicts.length > 0,
  };
}

export interface CalculateRemainingForLineParams {
  lineIdx: number;
  targetType: 'item' | 'bundle';
  targetId: string;
  items: RentalOrderItemLike[];
  rentalItems: PoolRentalItem[];
  rentalBundles: PoolRentalBundle[];
  availabilityMap?: Record<string, number> | null;
  getAvailableUnits?: (rentalItemId: string) => number;
}

/**
 * Calculates the dynamic remaining capacity for a specific line item,
 * after taking into account what other lines have already allocated.
 */
export function calculateRemainingForLine({
  lineIdx,
  targetType,
  targetId,
  items,
  rentalItems,
  rentalBundles,
  availabilityMap,
  getAvailableUnits,
}: CalculateRemainingForLineParams): number {
  const resolveAvailable = (rentalItemId: string): number => {
    if (getAvailableUnits) {
      return getAvailableUnits(rentalItemId);
    }
    if (availabilityMap && typeof availabilityMap[rentalItemId] === 'number') {
      return availabilityMap[rentalItemId];
    }
    const item = rentalItems.find((ri) => ri.id === rentalItemId);
    if (item?.units) {
      return item.units.filter(
        (u) => u.status !== 'MAINTENANCE' && u.status !== 'RETIRED'
      ).length;
    }
    return 0;
  };

  // Filter out the line being evaluated
  const otherItems = lineIdx >= 0 ? items.filter((_, idx) => idx !== lineIdx) : items;

  // Calculate demand consumed by other lines
  const { demandMap: otherDemandMap } = calculateCrossInventoryDemand({
    items: otherItems,
    rentalItems,
    rentalBundles,
    availabilityMap,
    getAvailableUnits,
  });

  if (targetType === 'item') {
    const totalAvail = resolveAvailable(targetId);
    const usedByOthers = otherDemandMap[targetId] || 0;
    return Math.max(0, totalAvail - usedByOthers);
  }

  if (targetType === 'bundle') {
    const bundle = rentalBundles.find((b) => b.id === targetId);
    if (!bundle || !bundle.components || bundle.components.length === 0) {
      return 0;
    }

    const bundleCapacities = bundle.components.map((comp) => {
      const compItemId = comp.rentalItemId;
      const totalAvail = resolveAvailable(compItemId);
      const usedByOthers = otherDemandMap[compItemId] || 0;
      const compRemaining = Math.max(0, totalAvail - usedByOthers);
      const compPerBundle = comp.quantity || 1;
      return Math.floor(compRemaining / compPerBundle);
    });

    return Math.max(0, Math.min(...bundleCapacities));
  }

  return 0;
}
