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
  RentalWebhookDeliveryType,
  RentalWebhookOutboxStatus,
} from '@sync-erp/database';
import { appRouter } from '@src/trpc/router';
import type { Context } from '@src/trpc/context';
import { defaultWebhookTransport } from '@src/services/webhook-ssrf-transport';

const COMPANY_ID = 'test-rental-webhook-outbox-admin-001';
const OTHER_COMPANY_ID = 'test-rental-webhook-outbox-admin-002';

const cleanupOutboxData = async () => {
  await prisma.rentalWebhookOutbox.deleteMany({
    where: {
      companyId: {
        in: [COMPANY_ID, OTHER_COMPANY_ID],
      },
    },
  });
};

const cleanupIntegrationData = async () => {
  await prisma.apiKey.deleteMany({
    where: { companyId: { in: [COMPANY_ID, OTHER_COMPANY_ID] } },
  });
  await prisma.integration.deleteMany({
    where: { companyId: { in: [COMPANY_ID, OTHER_COMPANY_ID] } },
  });
};

const seedIntegration = async (companyId: string) => {
  const existing = await prisma.integration.findFirst({
    where: { companyId, appId: 'custom-storefront' },
  });

  if (existing) {
    await prisma.apiKey.deleteMany({
      where: { integrationId: existing.id },
    });
    await prisma.integration.delete({ where: { id: existing.id } });
  }

  const integration = await prisma.integration.create({
    data: {
      companyId,
      appId: 'custom-storefront',
      name: 'Custom Storefront',
      isActive: true,
      config: {
        webhookUrl: 'http://storefront.test',
        paths: {
          newOrder: '/webhooks/rental/orders/{token}/created',
          paymentStatus: '/webhooks/rental/orders/{token}/payment-status',
        },
      },
    },
  });

  await prisma.apiKey.create({
    data: {
      companyId,
      integrationId: integration.id,
      keyHash: `hash-${companyId}`,
      keyPrefix: 'sk_test',
      name: 'Test Key',
      webhookUrl: 'http://storefront.test',
      webhookSecret: 'Bearer storefront-test-secret',
      isActive: true,
    },
  });

  return integration;
};

const buildCaller = () =>
  appRouter.createCaller({
    req: {
      headers: {},
    } as Context['req'],
    res: {} as Context['res'],
    userId: 'admin-user-001',
    companyId: COMPANY_ID,
    correlationId: 'test-rental-webhook-outbox-admin-router',
    idempotencyKey: undefined,
    businessShape: undefined,
    userRole: 'ADMIN',
    userPermissions: [],
    integrationId: undefined,
    isApiKeyAuth: false,
    permissions: undefined,
    apiKeyId: undefined,
  });

describe('Admin Router - Rental Webhook Outbox', () => {
  let transportMock: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Rental Webhook Outbox Admin Test Company',
      },
      update: {
        name: 'Rental Webhook Outbox Admin Test Company',
      },
    });

    await prisma.company.upsert({
      where: { id: OTHER_COMPANY_ID },
      create: {
        id: OTHER_COMPANY_ID,
        name: 'Rental Webhook Outbox Admin Test Company 2',
      },
      update: {
        name: 'Rental Webhook Outbox Admin Test Company 2',
      },
    });
  });

  afterAll(async () => {
    await cleanupOutboxData();
    await cleanupIntegrationData();
    await prisma.company.deleteMany({
      where: { id: { in: [COMPANY_ID, OTHER_COMPANY_ID] } },
    });
  });

  beforeEach(async () => {
    transportMock = vi.spyOn(defaultWebhookTransport, 'send');
    transportMock.mockReset();

    await cleanupOutboxData();
    await cleanupIntegrationData();

    await seedIntegration(COMPANY_ID);
    await seedIntegration(OTHER_COMPANY_ID);

    await prisma.rentalWebhookOutbox.createMany({
      data: [
        {
          companyId: COMPANY_ID,
          deliveryType: RentalWebhookDeliveryType.NEW_ORDER,
          orderPublicToken: 'admin-outbox-token-dead-001',
          orderNumber: 'RNT-ADMIN-0001',
          payload: {
            customerName: 'Dead Letter User',
            customerPhone: '628111111111',
            totalAmount: 100000,
          },
          autoRetry: false,
          status: RentalWebhookOutboxStatus.DEAD_LETTER,
          attempts: 1,
          nextAttemptAt: new Date(),
          lastError: 'Invalid WhatsApp Number',
          lastStatusCode: 400,
        },
        {
          companyId: COMPANY_ID,
          deliveryType: RentalWebhookDeliveryType.PAYMENT_STATUS,
          orderPublicToken: 'admin-outbox-token-failed-001',
          orderNumber: 'RNT-ADMIN-0002',
          payload: {
            action: 'confirmed',
            paymentReference: 'midtrans-admin-001',
            paymentMethod: 'qris',
          },
          autoRetry: true,
          status: RentalWebhookOutboxStatus.FAILED,
          attempts: 2,
          nextAttemptAt: new Date(Date.now() + 60_000),
          lastError: 'Proxy unavailable',
          lastStatusCode: 503,
        },
        {
          companyId: OTHER_COMPANY_ID,
          deliveryType: RentalWebhookDeliveryType.PAYMENT_STATUS,
          orderPublicToken: 'admin-outbox-token-foreign-001',
          orderNumber: 'RNT-ADMIN-OTHER-0001',
          payload: {
            action: 'confirmed',
          },
          autoRetry: true,
          status: RentalWebhookOutboxStatus.FAILED,
          attempts: 1,
          nextAttemptAt: new Date(Date.now() + 60_000),
          lastError: 'Should stay isolated',
          lastStatusCode: 503,
        },
      ],
    });
  });

  afterEach(() => {
    transportMock.mockRestore();
  });

  it('lists outbox entries and exposes detail scoped by company', async () => {
    const caller = buildCaller();

    const list = await caller.admin.listRentalWebhookOutbox({
      limit: 20,
      offset: 0,
    });

    expect(list.data).toHaveLength(2);
    expect(list.pagination.total).toBe(2);
    expect(
      list.data.every((entry) => entry.companyId === COMPANY_ID)
    ).toBe(true);

    const detail = await caller.admin.getRentalWebhookOutboxDetail({
      id: list.data[0].id,
    });

    expect(detail).toBeTruthy();
    expect(detail?.companyId).toBe(COMPANY_ID);
    expect(detail?.payload).toBeTruthy();
  });

  it('replays DEAD_LETTER and FAILED entries via admin API and delivers after worker cycle', async () => {
    const caller = buildCaller();

    const deadLetter =
      await prisma.rentalWebhookOutbox.findFirstOrThrow({
        where: {
          companyId: COMPANY_ID,
          status: RentalWebhookOutboxStatus.DEAD_LETTER,
        },
      });

    const firstReplay = await caller.admin.replayRentalWebhookOutbox({
      id: deadLetter.id,
    });
    const secondReplay = await caller.admin.replayRentalWebhookOutbox(
      {
        id: deadLetter.id,
      }
    );

    expect(firstReplay.success).toBe(true);
    expect(secondReplay.success).toBe(false);

    const replayed =
      await prisma.rentalWebhookOutbox.findUniqueOrThrow({
        where: { id: deadLetter.id },
      });
    expect(replayed.status).toBe(RentalWebhookOutboxStatus.PENDING);

    const bulkReplay =
      await caller.admin.replayRentalWebhookOutboxBulk({
        statuses: [RentalWebhookOutboxStatus.FAILED],
        limit: 100,
      });

    expect(bulkReplay.success).toBe(true);
    expect(bulkReplay.requeuedCount).toBe(1);

    const failedEntry =
      await prisma.rentalWebhookOutbox.findFirstOrThrow({
        where: {
          companyId: COMPANY_ID,
          orderPublicToken: 'admin-outbox-token-failed-001',
        },
      });

    expect(failedEntry.status).toBe(
      RentalWebhookOutboxStatus.PENDING
    );

    const foreignEntry =
      await prisma.rentalWebhookOutbox.findFirstOrThrow({
        where: {
          companyId: OTHER_COMPANY_ID,
          orderPublicToken: 'admin-outbox-token-foreign-001',
        },
      });

    expect(foreignEntry.status).toBe(
      RentalWebhookOutboxStatus.FAILED
    );

    transportMock
      .mockResolvedValueOnce({ statusCode: 200 })
      .mockResolvedValueOnce({ statusCode: 200 });

    const { rentalWebhookOutboxService } =
      await import('@modules/rental/rental-webhook-outbox.service');

    await rentalWebhookOutboxService.processDueEntries();

    const deliveredDeadLetter =
      await prisma.rentalWebhookOutbox.findFirstOrThrow({
        where: {
          companyId: COMPANY_ID,
          orderPublicToken: 'admin-outbox-token-dead-001',
        },
      });

    const deliveredFailed =
      await prisma.rentalWebhookOutbox.findFirstOrThrow({
        where: {
          companyId: COMPANY_ID,
          orderPublicToken: 'admin-outbox-token-failed-001',
        },
      });

    expect(deliveredDeadLetter.status).toBe(
      RentalWebhookOutboxStatus.DELIVERED
    );
    expect(deliveredFailed.status).toBe(
      RentalWebhookOutboxStatus.DELIVERED
    );
  });
});
