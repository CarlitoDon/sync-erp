import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import type { Context } from '@src/trpc/context';
import { apiKeyService } from '@src/services/api-key.service';
import { redisRateLimitService } from '@src/modules/common/services/redis-rate-limit.service';
import * as bundleService from '@modules/rental/rental-bundle.service';
import * as bundleRepo from '@modules/rental/rental-bundle.repository';
import { rentalBundleRouter } from '@src/trpc/routers/rental-bundle.router';
import { mockPrisma } from './mocks/prisma.mock';

const COMPANY_A_ID = 'rental-bundle-containment-company-a';
const COMPANY_B_ID = 'rental-bundle-containment-company-b';

const buildCaller = (options: {
  companyId?: string;
  userId?: string;
  authorization?: string;
} = {}) =>
  rentalBundleRouter.createCaller({
    req: {
      headers: options.authorization
        ? { authorization: options.authorization }
        : {},
    } as Context['req'],
    res: {} as Context['res'],
    userId: options.userId,
    companyId: options.companyId,
    correlationId: 'rental-bundle-containment-test',
    idempotencyKey: undefined,
    businessShape: undefined,
    userRole: undefined,
    userPermissions: [],
    integrationId: undefined,
    isApiKeyAuth: false,
    permissions: undefined,
    apiKeyId: undefined,
  });

const validSyncInput = {
  bundles: [
    {
      externalId: 'containment-bundle',
      name: 'Containment Bundle',
      dailyRate: 100,
      includes: ['pillow'],
    },
  ],
};

describe('rental bundle catalog containment', () => {
  let validateKeySpy: ReturnType<typeof vi.spyOn>;
  let rateLimitSpy: ReturnType<typeof vi.spyOn>;
  let listSpy: ReturnType<typeof vi.spyOn>;
  let createSpy: ReturnType<typeof vi.spyOn>;
  let updateSpy: ReturnType<typeof vi.spyOn>;
  let findByExternalIdSpy: ReturnType<typeof vi.spyOn>;
  let syncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    validateKeySpy = vi.spyOn(apiKeyService, 'validateKey');
    rateLimitSpy = vi
      .spyOn(redisRateLimitService, 'consume')
      .mockResolvedValue({
        allowed: true,
        remaining: 999,
        retryAfterSeconds: 0,
      });
    listSpy = vi
      .spyOn(bundleService, 'list')
      .mockResolvedValue([] as never);
    createSpy = vi
      .spyOn(bundleService, 'create')
      .mockResolvedValue({ id: 'created-bundle' } as never);
    updateSpy = vi
      .spyOn(bundleService, 'update')
      .mockResolvedValue({ id: 'updated-bundle' } as never);
    findByExternalIdSpy = vi
      .spyOn(bundleService, 'findByExternalId')
      .mockResolvedValue({ id: 'found-bundle' } as never);
    syncSpy = vi
      .spyOn(bundleService, 'syncFromExternalCatalog')
      .mockResolvedValue({ synced: 1, bundles: [] } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated catalog find and sync before the service is reached', async () => {
    const caller = buildCaller();

    await expect(
      caller.findByExternalId({ externalId: 'containment-bundle' })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.syncFromExternalCatalog(validSyncInput)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });

    expect(findByExternalIdSpy).not.toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('requires the least-privilege rental permission for each API-key direction', async () => {
    validateKeySpy.mockResolvedValue({
      companyId: COMPANY_A_ID,
      permissions: ['rental:write'],
      keyId: 'containment-key',
      rateLimit: 1000,
    });

    await expect(
      buildCaller({ authorization: 'Bearer containment-key' }).findByExternalId({
        externalId: 'containment-bundle',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    validateKeySpy.mockResolvedValue({
      companyId: COMPANY_A_ID,
      permissions: ['rental:read'],
      keyId: 'containment-key',
      rateLimit: 1000,
    });

    await expect(
      buildCaller({ authorization: 'Bearer containment-key' }).syncFromExternalCatalog(
        validSyncInput
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(rateLimitSpy).toHaveBeenCalledTimes(2);
    expect(findByExternalIdSpy).not.toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('uses the real API-key hash result and derives the tenant from the key', async () => {
    validateKeySpy.mockRestore();

    const rawKey = 'sk_containment-runtime-key-1234567890';
    const keyHash = await bcrypt.hash(rawKey, 4);
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'runtime-key-id',
        keyHash,
        keyPrefix: rawKey.substring(0, 11),
        companyId: COMPANY_A_ID,
        permissions: ['rental:read'],
        expiresAt: null,
        rateLimit: 1000,
        integrationId: null,
      },
    ]);
    const update = vi.fn().mockResolvedValue({});
    Object.assign(mockPrisma.apiKey, { findMany, update });

    const invalidCaller = buildCaller({
      authorization: `Bearer ${rawKey}-tampered`,
      companyId: COMPANY_B_ID,
    });
    await expect(
      invalidCaller.findByExternalId({ externalId: 'containment-bundle' })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    const caller = buildCaller({
      authorization: `Bearer ${rawKey}`,
      companyId: COMPANY_B_ID,
    });
    await caller.findByExternalId({ externalId: 'containment-bundle' });

    expect(findMany).toHaveBeenCalledWith({
      where: { keyPrefix: rawKey.substring(0, 11), isActive: true },
      select: expect.any(Object),
    });
    expect(findByExternalIdSpy).toHaveBeenCalledWith({
      companyId: COMPANY_A_ID,
      externalId: 'containment-bundle',
    });
  });

  it('derives protected list/create/update company scope from context, not input', async () => {
    const caller = buildCaller({
      userId: 'containment-user-a',
      companyId: COMPANY_A_ID,
    });

    await caller.list({ companyId: COMPANY_B_ID } as never);
    await caller.create({
      companyId: COMPANY_B_ID,
      name: 'Scoped Bundle',
      dailyRate: 100,
    } as never);
    await caller.update({
      id: 'bundle-a',
      companyId: COMPANY_B_ID,
      name: 'Scoped Update',
    } as never);

    expect(listSpy).toHaveBeenCalledWith({ companyId: COMPANY_A_ID });
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_A_ID })
    );
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_A_ID })
    );
    expect(createSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_B_ID })
    );
    expect(updateSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_B_ID })
    );
  });

  it('allows a correctly scoped API key to read and sync only its tenant catalog', async () => {
    validateKeySpy.mockResolvedValue({
      companyId: COMPANY_A_ID,
      permissions: ['rental:read', 'rental:write'],
      keyId: 'containment-key',
      rateLimit: 1000,
    });

    const caller = buildCaller({ authorization: 'Bearer containment-key' });
    const found = await caller.findByExternalId({
      externalId: 'containment-bundle',
    });
    const synced = await caller.syncFromExternalCatalog({
      ...validSyncInput,
      companyId: COMPANY_B_ID,
    } as never);

    expect(found).toEqual({ id: 'found-bundle' });
    expect(synced.synced).toBe(1);
    expect(findByExternalIdSpy).toHaveBeenCalledWith({
      companyId: COMPANY_A_ID,
      externalId: 'containment-bundle',
    });
    expect(syncSpy).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_A_ID })
    );
  });

  it('bounds protected components and external catalog batches before service calls', async () => {
    const protectedCaller = buildCaller({
      userId: 'containment-user-a',
      companyId: COMPANY_A_ID,
    });

    await expect(
      protectedCaller.create({
        name: 'Oversized Bundle',
        dailyRate: 100,
        components: Array.from(
          { length: bundleService.MAX_CATALOG_COMPONENTS_PER_BUNDLE + 1 },
          (_, index) => ({
            rentalItemId: `rental-item-${index}`,
            quantity: 1,
            componentLabel: `Item ${index}`,
          })
        ),
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    validateKeySpy.mockResolvedValue({
      companyId: COMPANY_A_ID,
      permissions: ['rental:write'],
      keyId: 'containment-key',
      rateLimit: 1000,
    });

    const apiKeyCaller = buildCaller({
      authorization: 'Bearer containment-key',
    });
    await expect(
      apiKeyCaller.syncFromExternalCatalog({
        bundles: Array.from(
          { length: bundleService.MAX_CATALOG_BUNDLES + 1 },
          (_, index) => ({
            externalId: `oversized-bundle-${index}`,
            name: `Oversized Bundle ${index}`,
            dailyRate: 100,
            includes: [],
          })
        ),
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(createSpy).not.toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('rejects a protected create that references a rental item from another tenant', async () => {
    createSpy.mockRestore();
    const findRentalItemsSpy = vi
      .spyOn(bundleRepo, 'findRentalItemsByIds')
      .mockResolvedValue([]);

    await expect(
      bundleService.create({
        companyId: COMPANY_A_ID,
        name: 'Foreign Component Bundle',
        dailyRate: 100,
        components: [
          {
            rentalItemId: 'rental-item-owned-by-company-b',
            quantity: 1,
            componentLabel: 'Foreign item',
          },
        ],
      })
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(findRentalItemsSpy).toHaveBeenCalledWith(
      COMPANY_A_ID,
      ['rental-item-owned-by-company-b'],
      expect.any(Object)
    );
  });

  it('rejects unbounded external component quantities before opening a transaction', async () => {
    syncSpy.mockRestore();
    const transactionSpy = vi.spyOn(bundleRepo, 'runInTransaction');

    for (const include of ['0 pillow', '1001 pillow', `${'9'.repeat(200)} pillow`]) {
      await expect(
        bundleService.syncFromExternalCatalog({
          companyId: COMPANY_A_ID,
          bundles: [
            {
              externalId: `invalid-quantity-${include.slice(0, 3)}`,
              name: 'Invalid Quantity Bundle',
              dailyRate: 100,
              includes: [include],
            },
          ],
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    }

    expect(transactionSpy).not.toHaveBeenCalled();
  });

  it('uses one transaction client for component ownership and bundle creation', async () => {
    createSpy.mockRestore();
    const findRentalItemsSpy = vi
      .spyOn(bundleRepo, 'findRentalItemsByIds')
      .mockResolvedValue([{ id: 'rental-item-owned-by-company-a' }]);
    const createRepositorySpy = vi
      .spyOn(bundleRepo, 'create')
      .mockResolvedValue({ id: 'created-bundle' } as never);

    await bundleService.create({
      companyId: COMPANY_A_ID,
      name: 'Atomic Bundle',
      dailyRate: 100,
      components: [
        {
          rentalItemId: 'rental-item-owned-by-company-a',
          quantity: 1,
          componentLabel: 'Owned item',
        },
      ],
    });

    expect(findRentalItemsSpy.mock.calls[0]?.[2]).toBe(
      createRepositorySpy.mock.calls[0]?.[1]
    );
  });

  it('enforces the catalog batch limit in the service before opening a transaction', async () => {
    syncSpy.mockRestore();
    const transactionSpy = vi.spyOn(bundleRepo, 'runInTransaction');

    await expect(
      bundleService.syncFromExternalCatalog({
        companyId: COMPANY_A_ID,
        bundles: Array.from(
          { length: bundleService.MAX_CATALOG_BUNDLES + 1 },
          (_, index) => ({
            externalId: `service-oversized-bundle-${index}`,
            name: `Service Oversized Bundle ${index}`,
            dailyRate: 100,
            includes: [],
          })
        ),
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(transactionSpy).not.toHaveBeenCalled();
  });

  it('fails closed when an update cannot find the bundle in the authenticated tenant', async () => {
    updateSpy.mockRestore();
    const updateRepositorySpy = vi
      .spyOn(bundleRepo, 'update')
      .mockResolvedValue(null);

    await expect(
      bundleService.update({
        id: 'bundle-owned-by-company-b',
        companyId: COMPANY_A_ID,
        name: 'Cross-tenant update',
      })
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(updateRepositorySpy).toHaveBeenCalledWith(
      'bundle-owned-by-company-b',
      COMPANY_A_ID,
      { name: 'Cross-tenant update' }
    );
  });
});
