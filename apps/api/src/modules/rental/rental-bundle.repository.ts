/**
 * Rental Bundle Repository
 *
 * All database operations for RentalBundle and related entities
 */
import {
  prisma,
  DepositPolicyType,
  Prisma,
} from '@sync-erp/database';
import { UnitStatus } from '@sync-erp/shared';

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

export async function runInTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(operation);
}

// Include definitions for consistent queries
function bundleWithComponentsInclude(companyId: string) {
  return {
    components: {
      where: { rentalItem: { companyId } },
      include: { rentalItem: { include: { product: true } } },
    },
  } as const;
}

function bundleWithAvailabilityInclude(companyId: string) {
  return {
    components: {
      where: { rentalItem: { companyId } },
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
  } as const;
}

// ============================================
// Read Operations
// ============================================

export async function findMany(companyId: string) {
  return prisma.rentalBundle.findMany({
    where: { companyId, isActive: true },
    include: bundleWithComponentsInclude(companyId),
    orderBy: { dailyRate: 'asc' },
  });
}

export async function findById(id: string, companyId: string) {
  return prisma.rentalBundle.findFirst({
    where: { id, companyId },
    include: bundleWithComponentsInclude(companyId),
  });
}

export async function findByIdWithAvailability(
  id: string,
  companyId: string
) {
  return prisma.rentalBundle.findFirst({
    where: { id, companyId },
    include: bundleWithAvailabilityInclude(companyId),
  });
}

export async function findByExternalId(
  companyId: string,
  externalId: string
) {
  return prisma.rentalBundle.findUnique({
    where: {
      companyId_externalId: { companyId, externalId },
    },
    include: {
      components: {
        where: { rentalItem: { companyId } },
      },
    },
  });
}

// ============================================
// Write Operations
// ============================================

interface CreateBundleData {
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

export async function create(
  data: CreateBundleData,
  db: DatabaseClient = prisma
) {
  const { components, ...bundleData } = data;

  return db.rentalBundle.create({
    data: {
      ...bundleData,
      components: components ? { create: components } : undefined,
    },
    include: { components: true },
  });
}

interface UpdateBundleData {
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

export async function update(
  id: string,
  companyId: string,
  data: UpdateBundleData
) {
  return prisma.$transaction(async (tx) => {
    const ownedBundle = await tx.rentalBundle.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!ownedBundle) {
      return null;
    }

    return tx.rentalBundle.update({
      where: { id: ownedBundle.id },
      data,
      include: {
        components: {
          where: { rentalItem: { companyId } },
        },
      },
    });
  });
}

interface UpsertBundleData {
  companyId: string;
  externalId: string;
  name: string;
  shortName?: string;
  description?: string;
  dailyRate: number;
  dimensions?: string;
  capacity?: string;
  imagePath?: string;
}

export async function upsertByExternalId(
  data: UpsertBundleData,
  db: DatabaseClient = prisma
) {
  return db.rentalBundle.upsert({
    where: {
      companyId_externalId: {
        companyId: data.companyId,
        externalId: data.externalId,
      },
    },
    create: data,
    update: {
      name: data.name,
      shortName: data.shortName,
      description: data.description,
      dailyRate: data.dailyRate,
      dimensions: data.dimensions,
      capacity: data.capacity,
      imagePath: data.imagePath,
    },
  });
}

// ============================================
// Component Operations
// ============================================

export async function deleteComponentsByBundleId(
  bundleId: string,
  db: DatabaseClient = prisma
): Promise<{ count: number }> {
  return db.rentalBundleComponent.deleteMany({
    where: { bundleId },
  });
}

export async function createComponent(data: {
  bundleId: string;
  rentalItemId: string;
  quantity: number;
  componentLabel: string;
}, db: DatabaseClient = prisma) {
  return db.rentalBundleComponent.create({ data });
}

// ============================================
// Product/RentalItem Lookup (for sync)
// ============================================

export async function findProductByName(
  companyId: string,
  name: string,
  db: DatabaseClient = prisma
) {
  return db.product.findFirst({
    where: {
      companyId,
      name: { equals: name, mode: 'insensitive' },
    },
  });
}

export async function createProduct(data: {
  companyId: string;
  name: string;
  sku: string;
  price: number;
}, db: DatabaseClient = prisma) {
  return db.product.create({ data });
}

export async function findRentalItemByProductId(
  companyId: string,
  productId: string,
  db: DatabaseClient = prisma
) {
  return db.rentalItem.findFirst({
    where: { companyId, productId },
  });
}

export async function createRentalItem(data: {
  companyId: string;
  productId: string;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  depositPolicyType: DepositPolicyType;
  isActive: boolean;
}, db: DatabaseClient = prisma) {
  return db.rentalItem.create({ data });
}

export async function findRentalItemsByIds(
  companyId: string,
  rentalItemIds: string[],
  db: DatabaseClient = prisma
) {
  return db.rentalItem.findMany({
    where: {
      companyId,
      id: { in: rentalItemIds },
    },
    select: { id: true },
  });
}
