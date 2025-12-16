import {
  prisma,
  Prisma,
  IdempotencyScope,
  IdempotencyStatus,
} from '@sync-erp/database';

// Zombie lock timeout in milliseconds (5 minutes)
const ZOMBIE_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export class IdempotencyService {
  /**
   * Try to lock an idempotency key.
   * - If key exists and COMPLETED: return { saved: true, response: ... }
   * - If key exists and PROCESSING (not stale): throw Error (Concurrent Request)
   * - If key exists and PROCESSING (stale): delete and retry as new
   * - If key exists but entityId mismatch: throw Error (Entity Mismatch)
   * - If new: create key with PROCESSING and return { saved: false }
   */
  async lock<T = Prisma.JsonObject>(
    key: string,
    companyId: string,
    scope: IdempotencyScope,
    entityId: string
  ): Promise<{ saved: boolean; response?: T }> {
    // 1. Check if exists
    const existing = await prisma.idempotencyKey.findUnique({
      where: { id: key },
    });

    if (existing) {
      if (existing.companyId !== companyId) {
        console.warn(
          `[IDEMPOTENCY] Ownership mismatch: key=${key}, expected company=${companyId}, got=${existing.companyId}`
        );
        throw new Error('Idempotency key ownership mismatch');
      }
      if (existing.scope !== scope) {
        console.warn(
          `[IDEMPOTENCY] Scope mismatch: key=${key}, expected=${scope}, got=${existing.scope}`
        );
        throw new Error(
          `Idempotency key scope mismatch: expected ${scope}`
        );
      }
      // T006: Entity ID validation - if existing key has entityId AND it differs, reject
      if (existing.entityId && existing.entityId !== entityId) {
        console.warn(
          `[IDEMPOTENCY] Entity mismatch: key=${key}, expected entity=${entityId}, got=${existing.entityId}`
        );
        throw new Error(
          `Idempotency key entity mismatch: key is bound to entity ${existing.entityId}`
        );
      }

      if (existing.status === IdempotencyStatus.PROCESSING) {
        // Check if this is a zombie lock (stale PROCESSING)
        const lockAge = Date.now() - existing.updatedAt.getTime();
        if (lockAge > ZOMBIE_LOCK_TIMEOUT_MS) {
          // Zombie detected - delete and allow retry
          await prisma.idempotencyKey.delete({ where: { id: key } });
          // Fall through to create new lock
        } else {
          throw new Error(
            'Detailed conflict: Request with this key is currently processing. Please wait.'
          );
        }
      } else if (existing.status === IdempotencyStatus.COMPLETED) {
        return {
          saved: true,
          response: existing.response as T,
        };
      } else if (existing.status === IdempotencyStatus.FAILED) {
        // Failed status - delete and allow retry
        await prisma.idempotencyKey.delete({ where: { id: key } });
        // Fall through to create new lock
      }
    }

    // 2. Create new lock with entityId
    try {
      await prisma.idempotencyKey.create({
        data: {
          id: key,
          companyId,
          scope,
          entityId, // T007: Store entityId
          status: IdempotencyStatus.PROCESSING,
        },
      });
      return { saved: false };
    } catch (err) {
      // Handle race condition where another request created it just now
      if (
        (err as Prisma.PrismaClientKnownRequestError).code === 'P2002'
      ) {
        throw new Error(
          'Concurrent conflict: Idempotency key created by another process.'
        );
      }
      throw err;
    }
  }

  /**
   * Complete the operation and store response.
   */
  async complete(
    key: string,
    response: Prisma.InputJsonObject
  ): Promise<void> {
    await prisma.idempotencyKey.update({
      where: { id: key },
      data: {
        status: IdempotencyStatus.COMPLETED,
        response: response as Prisma.JsonObject,
      },
    });
  }

  /**
   * Optional: Release lock (delete) on failure if we want to allow retrying failures immediately.
   * Or we keep it as FAILED status? Spec only said PROCESSING | COMPLETED.
   * For now, if business logic throws, controller should probably NOT call complete,
   * but maybe we should expire stuck keys?
   * MVP: If it fails, transaction rolls back?
   * Prisma doesn't support nested transaction with this separate service easily unless passed tx.
   *
   * Strategy: If operation fails, we should delete the key so user can retry?
   * Or mark as FAILED?
   * User spec says: "If New, lock Key -> Execute -> Save Response -> Unlock".
   * If Execute fails, what happens?
   * The SPEC is silent on Failure. "Apple-like" implies strictly robust.
   * We will add `fail` method to remove key to allow retry.
   */
  async fail(key: string): Promise<void> {
    await prisma.idempotencyKey.delete({
      where: { id: key },
    });
  }
}
