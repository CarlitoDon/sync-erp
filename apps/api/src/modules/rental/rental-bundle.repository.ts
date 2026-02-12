/**
 * Rental Bundle Repository
 *
 * All database operations for RentalBundle and related entities
 */
import { prisma, DepositPolicyType } from '@sync-erp/database';
import { UnitStatus } from '@sync-erp/shared';

// Include definitions for consistent queries
const bundleWithComponentsInclude = {
  components: {
    include: { rentalItem: { include: { product: true } } },
  },
} as const;

const bundleWithAvailabilityInclude = {
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
} as const;

// ============================================
// Read Operations
// ============================================

export async function findMany(companyId: string) {
  return prisma.rentalBundle.findMany({
    where: { companyId, isActive: true },
    include: bundleWithComponentsInclude,
    orderBy: { dailyRate: 'asc' },
  });
}

export async function findById(id: string, companyId: string) {
  return prisma.rentalBundle.findFirst({
    where: { id, companyId },
    include: bundleWithComponentsInclude,
  });
}

export async function findByIdWithAvailability(
  id: string,
  companyId: string
) {
  return prisma.rentalBundle.findFirst({
    where: { id, companyId },
    include: bundleWithAvailabilityInclude,
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
    include: { components: true },
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

export async function create(data: CreateBundleData) {
  const { components, ...bundleData } = data;

  return prisma.rentalBundle.create({
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

export async function update(id: string, data: UpdateBundleData) {
  return prisma.rentalBundle.update({
    where: { id },
    data,
    include: { components: true },
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

export async function upsertByExternalId(data: UpsertBundleData) {
  return prisma.rentalBundle.upsert({
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
  bundleId: string
): Promise<{ count: number }> {
  return prisma.rentalBundleComponent.deleteMany({
    where: { bundleId },
  });
}

export async function createComponent(data: {
  bundleId: string;
  rentalItemId: string;
  quantity: number;
  componentLabel: string;
}) {
  return prisma.rentalBundleComponent.create({ data });
}

// ============================================
// Product/RentalItem Lookup (for sync)
// ============================================

export async function findProductByName(
  companyId: string,
  name: string
) {
  return prisma.product.findFirst({
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
}) {
  return prisma.product.create({ data });
}

export async function findRentalItemByProductId(
  companyId: string,
  productId: string
) {
  return prisma.rentalItem.findFirst({
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
}) {
  return prisma.rentalItem.create({ data });
}
