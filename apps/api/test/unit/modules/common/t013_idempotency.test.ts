import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdempotencyService } from '../../../../src/modules/common/services/idempotency.service';
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

  it('should lock new key successfully', async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue(
      null
    );
    vi.mocked(prisma.idempotencyKey.create).mockResolvedValue(
      {} as any
    );

    const result = await service.lock('key-1', 'co-1', 'TEST' as any);

    expect(result.saved).toBe(false);
    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: {
        id: 'key-1',
        companyId: 'co-1',
        scope: 'TEST',
        status: IdempotencyStatus.PROCESSING,
      },
    });
  });

  it('should return saved response if COMPLETED', async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue({
      id: 'key-1',
      companyId: 'co-1',
      scope: 'TEST',
      status: IdempotencyStatus.COMPLETED,
      response: { foo: 'bar' },
      updatedAt: new Date(),
      createdAt: new Date(),
    } as any);

    const result = await service.lock('key-1', 'co-1', 'TEST' as any);

    expect(result.saved).toBe(true);
    expect(result.response).toEqual({ foo: 'bar' });
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it('should throw error if PROCESSING (Concurrent)', async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue({
      id: 'key-1',
      companyId: 'co-1',
      scope: 'TEST',
      status: IdempotencyStatus.PROCESSING,
      updatedAt: new Date(), // Not stale
      createdAt: new Date(),
    } as any);

    await expect(
      service.lock('key-1', 'co-1', 'TEST' as any)
    ).rejects.toThrow(/processing/);
  });

  it('should throw error on Scope Mismatch', async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue({
      id: 'key-1',
      companyId: 'co-1',
      scope: 'OTHER',
      status: IdempotencyStatus.COMPLETED,
      updatedAt: new Date(),
      createdAt: new Date(),
    } as any);

    await expect(
      service.lock('key-1', 'co-1', 'TEST' as any)
    ).rejects.toThrow(/mismatch/);
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
