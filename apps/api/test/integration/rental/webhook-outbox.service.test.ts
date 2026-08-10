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
import { RentalWebhookService } from '@modules/rental/rental-webhook.service';
import { webhookOutboxService } from '@modules/rental/webhook-outbox.service';
import { defaultWebhookTransport } from '@src/services/webhook-ssrf-transport';

const COMPANY_ID = 'test-rental-webhook-outbox-001';

const ensureTestCompany = async () => {
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    create: {
      id: COMPANY_ID,
      name: 'Test Rental Webhook Company',
    },
    update: {},
  });
};

const cleanupOutboxData = async () => {
  await prisma.rentalWebhookOutbox.deleteMany({
    where: { companyId: COMPANY_ID },
  });
};

const cleanupIntegrationData = async () => {
  await prisma.apiKey.deleteMany({
    where: { companyId: COMPANY_ID },
  });
  await prisma.integration.deleteMany({
    where: { companyId: COMPANY_ID },
  });
};

import { integrationRegistry } from '@src/integrations/registry';

const observedWebhookEvents: string[] = [];

const seedIntegration = async (overrides?: {
  webhookUrl?: string;
  webhookSecret?: string;
  paths?: Record<string, string>;
  isActive?: boolean;
}) => {
  await ensureTestCompany();
  if (!integrationRegistry.get('test-plugin')) {
    integrationRegistry.register({
      manifest: {
        appId: 'test-plugin',
        name: 'Test Plugin',
        description: 'Test Plugin',
        icon: 'Test',
        capabilities: [],
        defaultConfig: {},
      },
      getWebhookPath: (event, token, _config) => {
        observedWebhookEvents.push(event);
        if (event === 'order.created') {
          return `/api/orders/${token}/notify-admin`;
        }
        if (event === 'payment.status.changed') {
          return `/api/orders/${token}/notify-payment`;
        }
        throw new Error('Unexpected rental webhook event');
      }
    });
  }

  await cleanupIntegrationData();

  const integration = await prisma.integration.create({
    data: {
      companyId: COMPANY_ID,
      appId: 'test-plugin',
      name: 'Test Plugin',
      isActive: overrides?.isActive ?? true,
      config: {
        webhookUrl: overrides?.webhookUrl ?? 'http://proxy.test',
      },
    },
  });

  await prisma.apiKey.create({
    data: {
      companyId: COMPANY_ID,
      integrationId: integration.id,
      keyHash: 'hash',
      keyPrefix: 'sk_test',
      name: 'Test Key',
      webhookUrl: overrides?.webhookUrl ?? 'http://proxy.test',
      webhookSecret:
        overrides?.webhookSecret ?? 'Bearer proxy-test-secret',
      isActive: true,
    },
  });

  return integration;
};

describe('WebhookOutboxService', () => {
  const transportSendMock = vi.spyOn(defaultWebhookTransport, 'send');

  beforeAll(async () => {
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Rental Webhook Outbox Test Company',
      },
      update: {
        name: 'Rental Webhook Outbox Test Company',
      },
    });
  });

  afterAll(async () => {
    transportSendMock.mockRestore();
    await cleanupOutboxData();
    await cleanupIntegrationData();
    await prisma.company.deleteMany({
      where: { id: COMPANY_ID },
    });
  });

  beforeEach(async () => {
    transportSendMock.mockReset();
    observedWebhookEvents.length = 0;
    await cleanupOutboxData();
    await seedIntegration();
  });

  afterEach(() => {
    delete process.env.RENTAL_WEBHOOK_OUTBOX_MAX_ATTEMPTS;
    delete process.env.RENTAL_WEBHOOK_OUTBOX_RETRY_BASE_MS;
    delete process.env.RENTAL_WEBHOOK_OUTBOX_RETRY_MAX_MS;
  });

  it('gracefully skips enqueue when no active integration is configured', async () => {
    await cleanupIntegrationData();

    const result = await webhookOutboxService.enqueue(
      RentalWebhookDeliveryType.PAYMENT_STATUS,
      {
        companyId: COMPANY_ID,
        orderPublicToken: 'skip-token-001',
        orderNumber: 'RNT-202603-SKIP01',
        payload: {
          action: 'confirmed',
          paymentMethod: 'qris',
          paymentReference: 'midtrans-skip',
          token: 'skip-token-001',
        },
      }
    );

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);

    const entry = await prisma.rentalWebhookOutbox.findFirst({
      where: {
        companyId: COMPANY_ID,
        orderPublicToken: 'skip-token-001',
      },
    });

    expect(entry).toBeNull();
  });

  it('persists failed payment notifications and delivers them on retry', async () => {
    transportSendMock.mockResolvedValueOnce({ statusCode: 503 });

    const queued = await webhookOutboxService.enqueue(
      RentalWebhookDeliveryType.PAYMENT_STATUS,
      {
        companyId: COMPANY_ID,
        orderPublicToken: 'payment-token-001',
        orderNumber: 'RNT-202603-00001',
        payload: {
          action: 'confirmed',
          paymentMethod: 'qris',
          paymentReference: 'midtrans-001',
          token: 'payment-token-001',
        },
      }
    );

    expect(queued.success).toBe(false);
    expect(queued.status).toBe(RentalWebhookOutboxStatus.FAILED);
    expect(queued.attempts).toBe(1);

    const failedEntry = await prisma.rentalWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        orderPublicToken: 'payment-token-001',
      },
    });

    const firstRequest = transportSendMock.mock.calls[0]?.[0];
    const firstHeaders = firstRequest?.headers ?? {};
    const expectedWebhookUrl =
      'http://proxy.test/api/orders/payment-token-001/notify-payment';
    expect(firstRequest?.url).toBe(expectedWebhookUrl);
    expect(JSON.parse(firstRequest?.body ?? '{}')).toMatchObject({
      action: 'confirmed',
      token: 'payment-token-001',
    });
    expect(firstHeaders['X-Webhook-Delivery-Id']).toBe(
      failedEntry.id
    );
    expect(firstHeaders['Idempotency-Key']).toBe(failedEntry.id);

    expect(failedEntry.status).toBe(RentalWebhookOutboxStatus.FAILED);
    expect(failedEntry.lastError).toBe('Webhook failed: 503');
    expect(failedEntry.lastStatusCode).toBe(503);

    transportSendMock.mockResolvedValueOnce({ statusCode: 200 });

    await prisma.rentalWebhookOutbox.update({
      where: { id: failedEntry.id },
      data: {
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    });

    const summary = await webhookOutboxService.processDueEntries();

    expect(summary).toMatchObject({
      processed: 1,
      delivered: 1,
      failed: 0,
      deadLettered: 0,
    });
    expect(transportSendMock).toHaveBeenCalledTimes(2);
    expect(observedWebhookEvents).toEqual([
      'payment.status.changed',
      'payment.status.changed',
    ]);
    expect(transportSendMock.mock.calls[1]?.[0].url).toBe(
      expectedWebhookUrl
    );

    const deliveredEntry =
      await prisma.rentalWebhookOutbox.findUniqueOrThrow({
        where: { id: failedEntry.id },
      });

    expect(deliveredEntry.status).toBe(
      RentalWebhookOutboxStatus.DELIVERED
    );
    expect(deliveredEntry.attempts).toBe(2);
    expect(deliveredEntry.deliveredAt).toBeTruthy();
  });

  it('dead-letters critical new-order failures so rollback paths do not auto-replay stale notifications', async () => {
    const webhookService = new RentalWebhookService();

    transportSendMock.mockResolvedValueOnce({ statusCode: 400 });

    await expect(
      webhookService.notifyNewOrder(
        {
          companyId: COMPANY_ID,
          token: 'new-order-token-001',
          orderNumber: 'RNT-202603-00002',
          customerName: 'Nomor Invalid',
          customerPhone: '081111111111',
          totalAmount: 100000,
        },
        { throwOnFailure: true }
      )
    ).rejects.toThrow('Webhook failed: 400');

    const entry = await prisma.rentalWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        orderPublicToken: 'new-order-token-001',
      },
    });

    expect(entry.status).toBe(RentalWebhookOutboxStatus.DEAD_LETTER);
    expect(entry.autoRetry).toBe(false);
    expect(entry.attempts).toBe(1);
    expect(entry.lastError).toBe('Webhook failed: 400');
  });

  it('allows manual replay from DEAD_LETTER and delivers after requeue', async () => {
    const webhookService = new RentalWebhookService();

    transportSendMock.mockResolvedValueOnce({ statusCode: 400 });

    await expect(
      webhookService.notifyNewOrder(
        {
          companyId: COMPANY_ID,
          token: 'new-order-token-replay-001',
          orderNumber: 'RNT-202603-00003',
          customerName: 'Replay Candidate',
          customerPhone: '081111111111',
          totalAmount: 120000,
        },
        { throwOnFailure: true }
      )
    ).rejects.toThrow('Webhook failed: 400');

    const deadLetter = await prisma.rentalWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        orderPublicToken: 'new-order-token-replay-001',
      },
    });

    expect(deadLetter.status).toBe(
      RentalWebhookOutboxStatus.DEAD_LETTER
    );

    const requeued = await webhookOutboxService.requeueDelivery(
      deadLetter.id,
      { companyId: COMPANY_ID }
    );
    expect(requeued).toBe(true);

    transportSendMock.mockResolvedValueOnce({ statusCode: 200 });

    const summary = await webhookOutboxService.processDueEntries();

    expect(summary).toMatchObject({
      processed: 1,
      delivered: 1,
    });

    const delivered = await prisma.rentalWebhookOutbox.findUniqueOrThrow({
      where: { id: deadLetter.id },
    });
    expect(delivered.status).toBe(
      RentalWebhookOutboxStatus.DELIVERED
    );
  });

  it('keeps replay idempotent by ignoring non-failed states on repeated requeue', async () => {
    transportSendMock.mockResolvedValueOnce({ statusCode: 503 });

    await webhookOutboxService.enqueue(RentalWebhookDeliveryType.PAYMENT_STATUS, {
      companyId: COMPANY_ID,
      orderPublicToken: 'payment-token-requeue-idempotent-001',
      orderNumber: 'RNT-202603-00004',
      payload: {
        action: 'confirmed',
        paymentMethod: 'qris',
        paymentReference: 'midtrans-002',
        token: 'payment-token-requeue-idempotent-001',
      },
    });

    const failed = await prisma.rentalWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        orderPublicToken: 'payment-token-requeue-idempotent-001',
      },
    });

    expect(failed.status).toBe(RentalWebhookOutboxStatus.FAILED);

    const firstReplay = await webhookOutboxService.requeueDelivery(
      failed.id,
      {
        companyId: COMPANY_ID,
      }
    );
    const secondReplay = await webhookOutboxService.requeueDelivery(
      failed.id,
      {
        companyId: COMPANY_ID,
      }
    );

    expect(firstReplay).toBe(true);
    expect(secondReplay).toBe(false);
  });

  it('does not auto-retry DEAD_LETTER entries without manual requeue', async () => {
    const webhookService = new RentalWebhookService();

    transportSendMock.mockResolvedValueOnce({ statusCode: 400 });

    await expect(
      webhookService.notifyNewOrder(
        {
          companyId: COMPANY_ID,
          token: 'new-order-token-no-auto-retry-001',
          orderNumber: 'RNT-202603-00005',
          customerName: 'No Auto Retry',
          customerPhone: '081111111111',
          totalAmount: 90000,
        },
        { throwOnFailure: true }
      )
    ).rejects.toThrow('Webhook failed: 400');

    const deadLetter = await prisma.rentalWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        orderPublicToken: 'new-order-token-no-auto-retry-001',
      },
    });

    await webhookOutboxService.processDueEntries();

    const unchanged = await prisma.rentalWebhookOutbox.findUniqueOrThrow({
      where: { id: deadLetter.id },
    });

    expect(unchanged.status).toBe(
      RentalWebhookOutboxStatus.DEAD_LETTER
    );
    expect(unchanged.attempts).toBe(deadLetter.attempts);
  });

  it('treats HTTP 429 as retryable for payment webhook and dead-letters at max attempts', async () => {
    process.env.RENTAL_WEBHOOK_OUTBOX_MAX_ATTEMPTS = '2';
    process.env.RENTAL_WEBHOOK_OUTBOX_RETRY_BASE_MS = '1';
    process.env.RENTAL_WEBHOOK_OUTBOX_RETRY_MAX_MS = '2';

    transportSendMock.mockResolvedValueOnce({ statusCode: 429 });

    const firstAttempt = await webhookOutboxService.enqueue(
      RentalWebhookDeliveryType.PAYMENT_STATUS,
      {
        companyId: COMPANY_ID,
        orderPublicToken: 'payment-token-retryable-429-001',
        orderNumber: 'RNT-202603-00006',
        payload: {
          action: 'confirmed',
          paymentMethod: 'qris',
          paymentReference: 'midtrans-429',
          token: 'payment-token-retryable-429-001',
        },
      }
    );

    expect(firstAttempt.success).toBe(false);
    expect(firstAttempt.status).toBe(
      RentalWebhookOutboxStatus.FAILED
    );
    expect(firstAttempt.statusCode).toBe(429);

    const failedEntry = await prisma.rentalWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        orderPublicToken: 'payment-token-retryable-429-001',
      },
    });

    await prisma.rentalWebhookOutbox.update({
      where: { id: failedEntry.id },
      data: {
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    });

    transportSendMock.mockResolvedValueOnce({ statusCode: 429 });

    const summary = await webhookOutboxService.processDueEntries();

    expect(summary).toMatchObject({
      processed: 1,
      delivered: 0,
      failed: 0,
      deadLettered: 1,
    });

    const deadLetter = await prisma.rentalWebhookOutbox.findUniqueOrThrow({
      where: { id: failedEntry.id },
    });

    expect(deadLetter.status).toBe(
      RentalWebhookOutboxStatus.DEAD_LETTER
    );
    expect(deadLetter.attempts).toBe(2);
    expect(deadLetter.lastStatusCode).toBe(429);
  });
});
