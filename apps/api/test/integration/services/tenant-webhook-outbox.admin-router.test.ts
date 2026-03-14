import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  prisma,
  TenantWebhookOutboxStatus,
} from '@sync-erp/database';
import { appRouter } from '@src/trpc/router';
import type { Context } from '@src/trpc/context';
import { tenantWebhookOutboxService } from '@src/services/tenant-webhook-outbox.service';

const COMPANY_ID = 'test-tenant-webhook-outbox-admin-001';
const OTHER_COMPANY_ID = 'test-tenant-webhook-outbox-admin-002';

const cleanupOutboxData = async () => {
  await prisma.tenantWebhookOutbox.deleteMany({
    where: {
      companyId: {
        in: [COMPANY_ID, OTHER_COMPANY_ID],
      },
    },
  });
};

const cleanupApiKeys = async () => {
  await prisma.apiKey.deleteMany({
    where: {
      companyId: {
        in: [COMPANY_ID, OTHER_COMPANY_ID],
      },
    },
  });
};

const buildCaller = () =>
  appRouter.createCaller({
    req: {
      headers: {},
    } as Context['req'],
    res: {} as Context['res'],
    userId: 'admin-user-tenant-webhook-001',
    companyId: COMPANY_ID,
    correlationId: 'test-tenant-webhook-outbox-admin-router',
    idempotencyKey: undefined,
    businessShape: undefined,
    userRole: undefined,
    userPermissions: [],
  });

describe('Admin Router - Tenant Webhook Outbox', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeAll(async () => {
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Tenant Webhook Outbox Admin Test Company',
      },
      update: {
        name: 'Tenant Webhook Outbox Admin Test Company',
      },
    });

    await prisma.company.upsert({
      where: { id: OTHER_COMPANY_ID },
      create: {
        id: OTHER_COMPANY_ID,
        name: 'Tenant Webhook Outbox Admin Test Company 2',
      },
      update: {
        name: 'Tenant Webhook Outbox Admin Test Company 2',
      },
    });
  });

  afterAll(async () => {
    await cleanupOutboxData();
    await cleanupApiKeys();
    await prisma.company.deleteMany({
      where: { id: { in: [COMPANY_ID, OTHER_COMPANY_ID] } },
    });
  });

  beforeEach(async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();

    await cleanupOutboxData();
    await cleanupApiKeys();

    const [apiKeyA, apiKeyB] = await Promise.all([
      prisma.apiKey.create({
        data: {
          keyHash: `tenant-admin-key-hash-a-${Date.now()}`,
          keyPrefix: 'tenant-a',
          name: 'Tenant A Key',
          companyId: COMPANY_ID,
          permissions: ['rental:read', 'rental:write'],
          webhookUrl: 'http://tenant-a-webhook.test/notify',
          webhookSecret: 'tenant-a-secret',
          isActive: true,
        },
      }),
      prisma.apiKey.create({
        data: {
          keyHash: `tenant-admin-key-hash-b-${Date.now()}`,
          keyPrefix: 'tenant-b',
          name: 'Tenant B Key',
          companyId: OTHER_COMPANY_ID,
          permissions: ['rental:read', 'rental:write'],
          webhookUrl: 'http://tenant-b-webhook.test/notify',
          webhookSecret: 'tenant-b-secret',
          isActive: true,
        },
      }),
    ]);

    await prisma.tenantWebhookOutbox.createMany({
      data: [
        {
          companyId: COMPANY_ID,
          apiKeyId: apiKeyA.id,
          event: 'payment.received',
          payload: {
            orderId: 'tenant-admin-order-dead-001',
            amount: 100000,
          },
          webhookUrl: 'http://tenant-a-webhook.test/notify',
          webhookSecret: 'tenant-a-secret',
          status: TenantWebhookOutboxStatus.DEAD_LETTER,
          attempts: 1,
          nextAttemptAt: new Date(),
          lastError: 'Bad request payload',
          lastStatusCode: 400,
        },
        {
          companyId: COMPANY_ID,
          apiKeyId: apiKeyA.id,
          event: 'order.created',
          payload: {
            orderId: 'tenant-admin-order-failed-001',
          },
          webhookUrl: 'http://tenant-a-webhook.test/notify',
          webhookSecret: 'tenant-a-secret',
          status: TenantWebhookOutboxStatus.FAILED,
          attempts: 2,
          nextAttemptAt: new Date(Date.now() + 60_000),
          lastError: 'Proxy unavailable',
          lastStatusCode: 503,
        },
        {
          companyId: OTHER_COMPANY_ID,
          apiKeyId: apiKeyB.id,
          event: 'payment.received',
          payload: {
            orderId: 'tenant-admin-order-foreign-001',
          },
          webhookUrl: 'http://tenant-b-webhook.test/notify',
          webhookSecret: 'tenant-b-secret',
          status: TenantWebhookOutboxStatus.FAILED,
          attempts: 1,
          nextAttemptAt: new Date(Date.now() + 60_000),
          lastError: 'Should stay isolated',
          lastStatusCode: 503,
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists tenant outbox entries and stats scoped by company', async () => {
    const caller = buildCaller();

    const stats = await caller.admin.getTenantWebhookOutboxStats();
    expect(stats.counts.deadLetter).toBe(1);
    expect(stats.counts.failed).toBe(1);

    const list = await caller.admin.listTenantWebhookOutbox({
      limit: 20,
      offset: 0,
    });

    expect(list.data).toHaveLength(2);
    expect(list.pagination.total).toBe(2);
    expect(
      list.data.every((entry) => entry.companyId === COMPANY_ID)
    ).toBe(true);

    const detail = await caller.admin.getTenantWebhookOutboxDetail({
      id: list.data[0].id,
    });

    expect(detail).toBeTruthy();
    expect(detail?.companyId).toBe(COMPANY_ID);
  });

  it('replays tenant DEAD_LETTER and FAILED entries through admin API', async () => {
    const caller = buildCaller();

    const deadLetter = await prisma.tenantWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        status: TenantWebhookOutboxStatus.DEAD_LETTER,
      },
    });

    const firstReplay = await caller.admin.replayTenantWebhookOutbox({
      id: deadLetter.id,
    });
    const secondReplay = await caller.admin.replayTenantWebhookOutbox({
      id: deadLetter.id,
    });

    expect(firstReplay.success).toBe(true);
    expect(secondReplay.success).toBe(false);

    const bulkReplay = await caller.admin.replayTenantWebhookOutboxBulk({
      statuses: [TenantWebhookOutboxStatus.FAILED],
      limit: 100,
    });

    expect(bulkReplay.success).toBe(true);
    expect(bulkReplay.requeuedCount).toBe(1);

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

    await tenantWebhookOutboxService.processDueEntries();

    const deliveredDeadLetter = await prisma.tenantWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        event: 'payment.received',
        payload: {
          path: ['orderId'],
          equals: 'tenant-admin-order-dead-001',
        },
      },
    });

    const deliveredFailed = await prisma.tenantWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        event: 'order.created',
      },
    });

    const foreignEntry = await prisma.tenantWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: OTHER_COMPANY_ID,
        event: 'payment.received',
      },
    });

    expect(deliveredDeadLetter.status).toBe(
      TenantWebhookOutboxStatus.DELIVERED
    );
    expect(deliveredFailed.status).toBe(
      TenantWebhookOutboxStatus.DELIVERED
    );
    expect(foreignEntry.status).toBe(TenantWebhookOutboxStatus.FAILED);
  });
});
