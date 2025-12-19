import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdempotencyService } from '@modules/common/services/idempotency.service';
import { prisma, IdempotencyStatus } from '@sync-erp/database';

// Automock prisma
vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');
  return {
    ...actual,
    prisma: {
      idempotencyKey: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

describe('T013: Idempotency Infrastructure', () => {
  let service: IdempotencyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IdempotencyService();
  });

  it('should lock new key successfully with entityId', async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue(
      null
    );
    vi.mocked(prisma.idempotencyKey.create).mockResolvedValue(
      {} as any
    );

    const result = await service.lock(
      'key-1',
      'co-1',
      'TEST' as any,
      'entity-1'
    );

    expect(result.saved).toBe(false);
    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: {
        id: 'key-1',
        companyId: 'co-1',
        scope: 'TEST',
        entityId: 'entity-1',
        status: IdempotencyStatus.PROCESSING,
      },
    });
  });

  it('should return saved response if COMPLETED with matching entityId', async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue({
      id: 'key-1',
      companyId: 'co-1',
      scope: 'TEST',
      entityId: 'entity-1',
      status: IdempotencyStatus.COMPLETED,
      response: { foo: 'bar' },
      updatedAt: new Date(),
      createdAt: new Date(),
    } as any);

    const result = await service.lock(
      'key-1',
      'co-1',
      'TEST' as any,
      'entity-1'
    );

    expect(result.saved).toBe(true);
    expect(result.response).toEqual({ foo: 'bar' });
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it('should throw error if PROCESSING (Concurrent)', async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue({
      id: 'key-1',
      companyId: 'co-1',
      scope: 'TEST',
      entityId: 'entity-1',
      status: IdempotencyStatus.PROCESSING,
      updatedAt: new Date(), // Not stale
      createdAt: new Date(),
    } as any);

    await expect(
      service.lock('key-1', 'co-1', 'TEST' as any, 'entity-1')
    ).rejects.toThrow(/processing/);
  });

  it('should throw error on Scope Mismatch', async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue({
      id: 'key-1',
      companyId: 'co-1',
      scope: 'OTHER',
      entityId: 'entity-1',
      status: IdempotencyStatus.COMPLETED,
      updatedAt: new Date(),
      createdAt: new Date(),
    } as any);

    await expect(
      service.lock('key-1', 'co-1', 'TEST' as any, 'entity-1')
    ).rejects.toThrow(/mismatch/);
  });

  // T009: Entity mismatch test - CRITICAL for fixing the bug
  it('should throw error on Entity Mismatch', async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue({
      id: 'key-1',
      companyId: 'co-1',
      scope: 'TEST',
      entityId: 'entity-A', // Bound to entity-A
      status: IdempotencyStatus.COMPLETED,
      response: { result: 'for-entity-A' },
      updatedAt: new Date(),
      createdAt: new Date(),
    } as any);

    // Try to use same key for entity-B
    await expect(
      service.lock('key-1', 'co-1', 'TEST' as any, 'entity-B')
    ).rejects.toThrow(/entity mismatch/i);
  });

  // T016: Backward compatibility - old keys without entityId should still work
  it('should accept old keys without entityId (backward compat)', async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue({
      id: 'key-1',
      companyId: 'co-1',
      scope: 'TEST',
      entityId: null, // Old key without entityId
      status: IdempotencyStatus.COMPLETED,
      response: { result: 'old-data' },
      updatedAt: new Date(),
      createdAt: new Date(),
    } as any);

    // Should work even with different entityId because old key has null entityId
    const result = await service.lock(
      'key-1',
      'co-1',
      'TEST' as any,
      'entity-new'
    );

    expect(result.saved).toBe(true);
    expect(result.response).toEqual({ result: 'old-data' });
  });

  it('should complete processing', async () => {
    await service.complete('key-1', { result: 'ok' });

    expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'key-1' },
        data: {
          status: IdempotencyStatus.COMPLETED,
          response: { result: 'ok' },
        },
      })
    );
  });
});
