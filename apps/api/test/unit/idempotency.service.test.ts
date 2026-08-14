import { describe, expect, it, vi, beforeEach } from 'vitest';
import { IdempotencyService } from '../../src/modules/common/services/idempotency.service';
import { mockPrisma } from '../setup';
import {
  IdempotencyScope,
  IdempotencyStatus,
} from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';

describe('IdempotencyService Unit', () => {
  let service: IdempotencyService;
  const key = 'unit-test-key';
  const companyId = 'company-1';
  const scope = IdempotencyScope.BILL_CREATE;

  beforeEach(() => {
    service = new IdempotencyService();
    vi.clearAllMocks();
  });

  it('acquireLock should return null and create key if not exists', async () => {
    // Mock findUnique returning null
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyKey.create.mockResolvedValue({ id: key });

    const result = await service.acquireLock(key, companyId, scope);

    expect(result).toBeNull();
    expect(mockPrisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: key,
        status: IdempotencyStatus.PROCESSING,
      }),
    });
  });

  it('acquireLock should return response if COMPLETED', async () => {
    const response = { id: 'bill-1' };
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
      id: key,
      companyId,
      scope,
      status: IdempotencyStatus.COMPLETED,
      response,
      updatedAt: new Date(),
    });

    const result = await service.acquireLock(key, companyId, scope);

    expect(result).toEqual(response);
    expect(mockPrisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it('acquireLock should throw CONFLICT if PROCESSING (active)', async () => {
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
      id: key,
      companyId,
      scope,
      status: IdempotencyStatus.PROCESSING,
      updatedAt: new Date(), // Just now
    });

    await expect(
      service.acquireLock(key, companyId, scope)
    ).rejects.toThrow(DomainError);
  });

  it('acquireLock should clean up and retry if FAILED', async () => {
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
      id: key,
      companyId,
      scope,
      status: IdempotencyStatus.FAILED,
      updatedAt: new Date(),
    });
    // First call to findUnique -> FAILED
    // delete called
    // create called

    mockPrisma.idempotencyKey.create.mockResolvedValue({ id: key });

    const result = await service.acquireLock(key, companyId, scope);
    expect(result).toBeNull();
    expect(mockPrisma.idempotencyKey.delete).toHaveBeenCalledWith({
      where: { id: key },
    });
    expect(mockPrisma.idempotencyKey.create).toHaveBeenCalled();
  });
});

describe('IdempotencyService fencing on create race', () => {
  let service: IdempotencyService;
  const key = 'race-key';
  const companyId = 'company-1';
  const scope = IdempotencyScope.BILL_CREATE;
  const entityId = 'bill-7';

  beforeEach(() => {
    service = new IdempotencyService();
    vi.clearAllMocks();
  });

  const p2002 = () => {
    const err = new Error('Unique constraint');
    (err as Error & { code?: string }).code = 'P2002';
    return err;
  };

  const winnerRow = (overrides: Record<string, unknown> = {}) => ({
    id: key,
    companyId,
    scope,
    entityId,
    status: IdempotencyStatus.PROCESSING,
    updatedAt: new Date(),
    createdAt: new Date(),
    response: null,
    ...overrides,
  });

  it('returns cached response when the race winner already COMPLETED', async () => {
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyKey.create.mockRejectedValueOnce(p2002());
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(
      winnerRow({
        status: IdempotencyStatus.COMPLETED,
        response: { id: 'bill-1' },
      })
    );

    const result = await service.lock(key, companyId, scope, entityId);

    expect(result).toEqual({ saved: true, response: { id: 'bill-1' } });
  });

  it('throws 409 when the race winner is actively PROCESSING', async () => {
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyKey.create.mockRejectedValueOnce(p2002());
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(
      winnerRow({ updatedAt: new Date() })
    );

    await expect(
      service.lock(key, companyId, scope, entityId)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows retry when the race winner is a stale PROCESSING lock', async () => {
    // First findUnique (initial read) -> null; second (post-conflict re-read)
    // -> stale PROCESSING row.
    mockPrisma.idempotencyKey.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        winnerRow({
          updatedAt: new Date(Date.now() - 10 * 60 * 1000), // > 5 min stale
        })
      );
    mockPrisma.idempotencyKey.create.mockRejectedValueOnce(p2002());

    const result = await service.lock(key, companyId, scope, entityId);

    expect(result).toEqual({ saved: false });
  });

  it('allows retry when the race winner is FAILED', async () => {
    mockPrisma.idempotencyKey.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        winnerRow({ status: IdempotencyStatus.FAILED })
      );
    mockPrisma.idempotencyKey.create.mockRejectedValueOnce(p2002());

    const result = await service.lock(key, companyId, scope, entityId);

    expect(result).toEqual({ saved: false });
  });

  it('enforces ownership when the race winner belongs to another company', async () => {
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyKey.create.mockRejectedValueOnce(p2002());
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(
      winnerRow({ companyId: 'other-company' })
    );

    await expect(
      service.lock(key, companyId, scope, entityId)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('enforces scope when the race winner used a different scope', async () => {
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyKey.create.mockRejectedValueOnce(p2002());
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(
      winnerRow({ scope: IdempotencyScope.PAYMENT_CREATE })
    );

    await expect(
      service.lock(key, companyId, scope, entityId)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('enforces entity binding when the race winner is bound to another entity', async () => {
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyKey.create.mockRejectedValueOnce(p2002());
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(
      winnerRow({ entityId: 'bill-other' })
    );

    await expect(
      service.lock(key, companyId, scope, entityId)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 409 when the winner row vanished between create-failure and re-read', async () => {
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyKey.create.mockRejectedValueOnce(p2002());
    mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.lock(key, companyId, scope, entityId)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rethrows non-unique constraint errors from create', async () => {
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyKey.create.mockRejectedValueOnce(
      new Error('connection refused')
    );

    await expect(
      service.lock(key, companyId, scope, entityId)
    ).rejects.toThrow('connection refused');
  });
});
