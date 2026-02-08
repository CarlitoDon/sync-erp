/**
 * Payment Method Repository
 *
 * All database operations for CompanyPaymentMethod
 */
import { prisma, PaymentMethodType } from '@sync-erp/database';

// Include definition for consistent account selection
const accountInclude = {
  account: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
} as const;

export type PaymentMethodWithAccount = Awaited<
  ReturnType<typeof findById>
>;

interface ListOptions {
  companyId: string;
  includeInactive?: boolean;
}

interface CreateData {
  companyId: string;
  code: string;
  name: string;
  type: PaymentMethodType;
  accountId: string | null;
  isDefault: boolean;
  sortOrder: number;
}

interface UpdateData {
  code?: string;
  name?: string;
  type?: PaymentMethodType;
  accountId?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

// ============================================
// Read Operations
// ============================================

export async function findMany(options: ListOptions) {
  const where: { companyId: string; isActive?: boolean } = {
    companyId: options.companyId,
  };

  if (!options.includeInactive) {
    where.isActive = true;
  }

  return prisma.companyPaymentMethod.findMany({
    where,
    include: accountInclude,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function findById(id: string, companyId: string) {
  return prisma.companyPaymentMethod.findFirst({
    where: { id, companyId },
    include: accountInclude,
  });
}

export async function findByCode(code: string, companyId: string) {
  return prisma.companyPaymentMethod.findFirst({
    where: { code, companyId },
  });
}

export async function findByCodeExcluding(
  code: string,
  companyId: string,
  excludeId: string
) {
  return prisma.companyPaymentMethod.findFirst({
    where: {
      companyId,
      code,
      id: { not: excludeId },
    },
  });
}

export async function count(companyId: string) {
  return prisma.companyPaymentMethod.count({
    where: { companyId },
  });
}

export async function findAccountByCode(
  code: string,
  companyId: string
) {
  return prisma.account.findFirst({
    where: { companyId, code },
  });
}

// ============================================
// Write Operations
// ============================================

export async function create(data: CreateData) {
  return prisma.companyPaymentMethod.create({
    data,
    include: accountInclude,
  });
}

export async function update(id: string, data: UpdateData) {
  return prisma.companyPaymentMethod.update({
    where: { id },
    data,
    include: accountInclude,
  });
}

export async function remove(id: string) {
  return prisma.companyPaymentMethod.delete({
    where: { id },
  });
}

export async function unsetDefaultsByType(
  companyId: string,
  type: PaymentMethodType,
  excludeId?: string
): Promise<{ count: number }> {
  const where: {
    companyId: string;
    type: PaymentMethodType;
    isDefault: boolean;
    id?: { not: string };
  } = {
    companyId,
    type,
    isDefault: true,
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  return prisma.companyPaymentMethod.updateMany({
    where,
    data: { isDefault: false },
  });
}

export async function createMany(
  data: Array<Omit<CreateData, 'accountId'> & { accountId?: string }>
): Promise<{ count: number }> {
  return prisma.companyPaymentMethod.createMany({
    data: data.map((d) => ({
      ...d,
      accountId: d.accountId ?? null,
    })),
  });
}
