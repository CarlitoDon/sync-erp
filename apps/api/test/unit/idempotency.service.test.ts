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
