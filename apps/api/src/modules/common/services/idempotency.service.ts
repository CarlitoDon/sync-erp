/**
 * Idempotency Service
 *
 * Business logic for request idempotency handling.
 * Prevents duplicate operations by tracking request keys.
 */
import {
  Prisma,
  IdempotencyScope,
  IdempotencyStatus,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import * as idempotencyRepo from '../repositories/idempotency.repository';

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
    const existing = await idempotencyRepo.findById(key);

    if (existing) {
      if (existing.companyId !== companyId) {
        throw new DomainError(
          'Idempotency key ownership mismatch',
          403,
          DomainErrorCodes.FORBIDDEN
        );
      }
      if (existing.scope !== scope) {
        throw new DomainError(
          `Idempotency key scope mismatch: expected ${scope}`,
          400,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }
      if (existing.entityId && existing.entityId !== entityId) {
        throw new DomainError(
          `Idempotency key entity mismatch: key is bound to entity ${existing.entityId}`,
          400,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }

      if (existing.status === IdempotencyStatus.PROCESSING) {
        const lockAge = Date.now() - existing.updatedAt.getTime();
        if (lockAge > ZOMBIE_LOCK_TIMEOUT_MS) {
          await idempotencyRepo.deleteById(key);
        } else {
          throw new DomainError(
            'Request with this key is currently processing. Please wait.',
            409,
            DomainErrorCodes.OPERATION_NOT_ALLOWED
          );
        }
      } else if (existing.status === IdempotencyStatus.COMPLETED) {
        return {
          saved: true,
          response: existing.response as T,
        };
      } else if (existing.status === IdempotencyStatus.FAILED) {
        await idempotencyRepo.deleteById(key);
      }
    }

    try {
      await idempotencyRepo.create({
        id: key,
        companyId,
        scope,
        entityId,
        status: IdempotencyStatus.PROCESSING,
      });
      return { saved: false };
    } catch (err) {
      if (
        (err as Prisma.PrismaClientKnownRequestError).code === 'P2002'
      ) {
        throw new DomainError(
          'Concurrent conflict: Idempotency key created by another process.',
          409,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }
      throw err;
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async acquireLock(
    key: string,
    companyId: string,
    scope: IdempotencyScope,
    entityId?: string
  ): Promise<unknown | null> {
    const result = await this.lock(
      key,
      companyId,
      scope,
      entityId || ''
    );
    if (result.saved) {
      return result.response;
    }
    return null;
  }

  /**
   * Complete the operation and store response.
   */
  async complete(
    key: string,
    response: Prisma.InputJsonObject
  ): Promise<void> {
    await idempotencyRepo.updateStatus(
      key,
      IdempotencyStatus.COMPLETED,
      response as Prisma.InputJsonValue
    );
  }

  /**
   * Mark operation as failed, allowing retry.
   */
  async fail(key: string, error?: unknown): Promise<void> {
    if (error) {
      await idempotencyRepo.updateStatus(
        key,
        IdempotencyStatus.FAILED,
        { error: String(error) } as Prisma.InputJsonValue
      );
    } else {
      await idempotencyRepo.deleteById(key);
    }
  }
}
