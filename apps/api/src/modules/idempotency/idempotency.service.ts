import {
  IdempotencyScope,
  IdempotencyStatus,
  prisma,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

export class IdempotencyService {
  /**
   * Tries to acquire a lock for an idempotency key.
   * If the key exists and is COMPLETED, returns the stored response.
   * If the key exists and is PROCESSING, throws a conflict error.
   * If the key does not exist, creates it in PROCESSING state and returns null.
   */
  async acquireLock(
    key: string,
    companyId: string,
    scope: IdempotencyScope,
    entityId?: string
  ): Promise<unknown | null> {
    // 1. Check if key exists
    const existing = await prisma.idempotencyKey.findUnique({
      where: { id: key },
    });

    if (existing) {
      if (existing.status === IdempotencyStatus.COMPLETED) {
        return existing.response;
      }

      if (existing.status === IdempotencyStatus.PROCESSING) {
        // Check for zombie locks (e.g. older than 1 minute)
        const now = new Date();
        const diff = now.getTime() - existing.updatedAt.getTime();
        if (diff > 60000) {
          // Zombie lock - fail it or allow retry?
          // Safer to error and ask client to retry with new key or same key after manual intervention?
          // For now, let's treat it as conflict but log it.
          console.warn(
            `[Idempotency] Zombie lock detected for key ${key}`
          );
        }
        throw new DomainError(
          'Request is currently being processed',
          DomainErrorCodes.CONFLICT
        );
      }

      if (existing.status === IdempotencyStatus.FAILED) {
        // If previous attempt failed, we allow retrying with the same key
        // by deleting the failed record and creating a new one.
        await prisma.idempotencyKey.delete({ where: { id: key } });
        // Proceed to create
      }
    }

    // 2. Create new key in PROCESSING state
    try {
      await prisma.idempotencyKey.create({
        data: {
          id: key,
          companyId,
          scope,
          entityId,
          status: IdempotencyStatus.PROCESSING,
        },
      });
      return null; // Lock acquired
    } catch (error) {
      // Race condition: someone else created it just now
      // Recursively check again (should hit existing block)
      return this.acquireLock(key, companyId, scope, entityId);
    }
  }

  /**
   * Completes an idempotency key processing by saving the response
   */
  async complete(key: string, response: unknown): Promise<void> {
    await prisma.idempotencyKey.update({
      where: { id: key },
      data: {
        status: IdempotencyStatus.COMPLETED,
        response: response as any, // Prisma Json type
      },
    });
  }

  /**
   * Marks an idempotency key as FAILED, allowing retries
   */
  async fail(key: string, error?: unknown): Promise<void> {
    await prisma.idempotencyKey.update({
      where: { id: key },
      data: {
        status: IdempotencyStatus.FAILED,
        response: { error } as any,
      },
    });
  }
}
