/**
 * Idempotency Repository
 *
 * Data access layer for idempotency key management.
 * Handles all database operations for request deduplication.
 */
import {
  prisma,
  Prisma,
  IdempotencyScope,
  IdempotencyStatus,
} from '@sync-erp/database';

export interface IdempotencyKeyData {
  id: string;
  companyId: string;
  scope: IdempotencyScope;
  entityId: string | null;
  status: IdempotencyStatus;
  response?: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Queries
// ============================================

export async function findById(
  key: string
): Promise<IdempotencyKeyData | null> {
  return prisma.idempotencyKey.findUnique({
    where: { id: key },
  });
}

// ============================================
// Commands
// ============================================

export async function create(data: {
  id: string;
  companyId: string;
  scope: IdempotencyScope;
  entityId?: string;
  status: IdempotencyStatus;
}): Promise<IdempotencyKeyData> {
  return prisma.idempotencyKey.create({
    data: {
      ...data,
      entityId: data.entityId || null,
    },
  });
}

export async function updateStatus(
  key: string,
  status: IdempotencyStatus,
  response?: Prisma.InputJsonValue
): Promise<IdempotencyKeyData> {
  return prisma.idempotencyKey.update({
    where: { id: key },
    data: {
      status,
      response: response ?? undefined,
    },
  });
}

export async function deleteById(key: string): Promise<void> {
  await prisma.idempotencyKey.delete({
    where: { id: key },
  });
}

export async function deleteByIdIfExists(
  key: string
): Promise<boolean> {
  try {
    await prisma.idempotencyKey.delete({
      where: { id: key },
    });
    return true;
  } catch {
    return false;
  }
}
