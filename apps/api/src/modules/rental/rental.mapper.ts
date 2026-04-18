import type {
  RentalItemWithRelations,
  PrismaRentalOrderWithRelations,
  PortableRentalOrder,
} from '@sync-erp/shared';

function serializeDecimal(obj: unknown): unknown {
  if (!obj) return obj;
  if (typeof obj === 'object' && obj !== null) {
    if ('toNumber' in obj && 'toString' in obj) {
      // It's a Prisma.Decimal or Decimal.js
      return (obj as { toString(): string }).toString();
    }
    if (obj instanceof Date) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(serializeDecimal);
    }
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      result[key] = serializeDecimal((obj as Record<string, unknown>)[key]);
    }
    return result;
  }
  return obj;
}

// BOUNDARY: Mapper from Prisma types (which have Decimal objects) to Domain Types (which use string/number or exact schemas)
// This ensures we drop the unsafe `any` and `unknown` casting and properly transform the objects.

export function mapToRentalItem(prismaItem: unknown): RentalItemWithRelations {
  return serializeDecimal(prismaItem) as RentalItemWithRelations;
}

export function mapToRentalOrder(prismaOrder: unknown): PrismaRentalOrderWithRelations {
  return serializeDecimal(prismaOrder) as PrismaRentalOrderWithRelations;
}

export function mapToPortableOrder(prismaOrder: unknown): PortableRentalOrder {
  return serializeDecimal(prismaOrder) as PortableRentalOrder;
}
