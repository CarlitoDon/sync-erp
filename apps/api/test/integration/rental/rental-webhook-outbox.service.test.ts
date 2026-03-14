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
  RentalWebhookOutboxStatus,
} from '@sync-erp/database';
import {
  RentalWebhookService,
} from '@modules/rental/rental-webhook.service';
import {
  rentalWebhookOutboxService,
} from '@modules/rental/rental-webhook-outbox.service';

const COMPANY_ID = 'test-rental-webhook-outbox-001';

const cleanupOutboxData = async () => {
  await prisma.rentalWebhookOutbox.deleteMany({
    where: { companyId: COMPANY_ID },
  });
};

describe('RentalWebhookOutboxService', () => {
  const fetchMock = vi.fn<typeof fetch>();

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
    await cleanupOutboxData();
    await prisma.company.deleteMany({
      where: { id: COMPANY_ID },
    });
  });

  beforeEach(async () => {
    process.env.SANTI_LIVING_WEBHOOK_URL = 'http://proxy.test';
    process.env.SANTI_LIVING_WEBHOOK_API_KEY = 'proxy-test-secret';
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    await cleanupOutboxData();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RENTAL_WEBHOOK_OUTBOX_MAX_ATTEMPTS;
    delete process.env.RENTAL_WEBHOOK_OUTBOX_RETRY_BASE_MS;
    delete process.env.RENTAL_WEBHOOK_OUTBOX_RETRY_MAX_MS;
  });

  it('persists failed payment notifications and delivers them on retry', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ message: 'Proxy unavailable' }),
    } as Response);

    const queued =
      await rentalWebhookOutboxService.enqueuePaymentStatus({
        companyId: COMPANY_ID,
        token: 'payment-token-001',
        orderNumber: 'RNT-202603-00001',
        action: 'confirmed',
        paymentMethod: 'qris',
        paymentReference: 'midtrans-001',
      });

    expect(queued.success).toBe(false);
    expect(queued.status).toBe(RentalWebhookOutboxStatus.FAILED);
    expect(queued.attempts).toBe(1);

    const failedEntry = await prisma.rentalWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        orderPublicToken: 'payment-token-001',
      },
    });

    const firstFetchCall = fetchMock.mock.calls[0];
    const firstFetchOptions = firstFetchCall?.[1] as
      | RequestInit
      | undefined;
    const firstHeaders = (firstFetchOptions?.headers || {}) as Record<
      string,
      string
    >;
    expect(firstHeaders['X-Webhook-Delivery-Id']).toBe(failedEntry.id);
    expect(firstHeaders['Idempotency-Key']).toBe(failedEntry.id);

    expect(failedEntry.status).toBe(RentalWebhookOutboxStatus.FAILED);
    expect(failedEntry.lastError).toBe('Proxy unavailable');
    expect(failedEntry.lastStatusCode).toBe(503);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response);

    await prisma.rentalWebhookOutbox.update({
      where: { id: failedEntry.id },
      data: {
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    });

    const summary =
      await rentalWebhookOutboxService.processDueEntries();

    expect(summary).toMatchObject({
      processed: 1,
      delivered: 1,
      failed: 0,
      deadLettered: 0,
    });

    const deliveredEntry = await prisma.rentalWebhookOutbox.findUniqueOrThrow({
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

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid WhatsApp Number' }),
    } as Response);

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
    ).rejects.toThrow('Invalid WhatsApp Number');

    const entry = await prisma.rentalWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        orderPublicToken: 'new-order-token-001',
      },
    });

    expect(entry.status).toBe(
      RentalWebhookOutboxStatus.DEAD_LETTER
    );
    expect(entry.autoRetry).toBe(false);
    expect(entry.attempts).toBe(1);
    expect(entry.lastError).toBe('Invalid WhatsApp Number');
  });

  it('allows manual replay from DEAD_LETTER and delivers after requeue', async () => {
    const webhookService = new RentalWebhookService();

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid WhatsApp Number' }),
    } as Response);

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
    ).rejects.toThrow('Invalid WhatsApp Number');

    const deadLetter = await prisma.rentalWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        orderPublicToken: 'new-order-token-replay-001',
      },
    });

    expect(deadLetter.status).toBe(RentalWebhookOutboxStatus.DEAD_LETTER);

    const requeued = await rentalWebhookOutboxService.requeueDelivery(
      deadLetter.id,
      { companyId: COMPANY_ID }
    );
    expect(requeued).toBe(true);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response);

    const summary = await rentalWebhookOutboxService.processDueEntries();

    expect(summary).toMatchObject({
      processed: 1,
      delivered: 1,
    });

    const delivered = await prisma.rentalWebhookOutbox.findUniqueOrThrow({
      where: { id: deadLetter.id },
    });
    expect(delivered.status).toBe(RentalWebhookOutboxStatus.DELIVERED);
  });

  it('keeps replay idempotent by ignoring non-failed states on repeated requeue', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ message: 'Proxy unavailable' }),
    } as Response);

    await rentalWebhookOutboxService.enqueuePaymentStatus({
      companyId: COMPANY_ID,
      token: 'payment-token-requeue-idempotent-001',
      orderNumber: 'RNT-202603-00004',
      action: 'confirmed',
      paymentMethod: 'qris',
      paymentReference: 'midtrans-002',
    });

    const failed = await prisma.rentalWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        orderPublicToken: 'payment-token-requeue-idempotent-001',
      },
    });

    expect(failed.status).toBe(RentalWebhookOutboxStatus.FAILED);

    const firstReplay = await rentalWebhookOutboxService.requeueDelivery(
      failed.id,
      { companyId: COMPANY_ID }
    );
    const secondReplay = await rentalWebhookOutboxService.requeueDelivery(
      failed.id,
      { companyId: COMPANY_ID }
    );

    expect(firstReplay).toBe(true);
    expect(secondReplay).toBe(false);
  });

  it('does not auto-retry DEAD_LETTER entries without manual requeue', async () => {
    const webhookService = new RentalWebhookService();

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid WhatsApp Number' }),
    } as Response);

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
    ).rejects.toThrow('Invalid WhatsApp Number');

    const deadLetter = await prisma.rentalWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        orderPublicToken: 'new-order-token-no-auto-retry-001',
      },
    });

    await rentalWebhookOutboxService.processDueEntries();

    const unchanged = await prisma.rentalWebhookOutbox.findUniqueOrThrow({
      where: { id: deadLetter.id },
    });

    expect(unchanged.status).toBe(RentalWebhookOutboxStatus.DEAD_LETTER);
    expect(unchanged.attempts).toBe(deadLetter.attempts);
  });

  it('treats HTTP 429 as retryable for payment webhook and dead-letters at max attempts', async () => {
    process.env.RENTAL_WEBHOOK_OUTBOX_MAX_ATTEMPTS = '2';
    process.env.RENTAL_WEBHOOK_OUTBOX_RETRY_BASE_MS = '1';
    process.env.RENTAL_WEBHOOK_OUTBOX_RETRY_MAX_MS = '2';

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Too many requests' }),
    } as Response);

    const firstAttempt = await rentalWebhookOutboxService.enqueuePaymentStatus({
      companyId: COMPANY_ID,
      token: 'payment-token-retryable-429-001',
      orderNumber: 'RNT-202603-00006',
      action: 'confirmed',
      paymentMethod: 'qris',
      paymentReference: 'midtrans-429',
    });

    expect(firstAttempt.success).toBe(false);
    expect(firstAttempt.status).toBe(RentalWebhookOutboxStatus.FAILED);
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

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Too many requests again' }),
    } as Response);

    const summary = await rentalWebhookOutboxService.processDueEntries();

    expect(summary).toMatchObject({
      processed: 1,
      delivered: 0,
      failed: 0,
      deadLettered: 1,
    });

    const deadLetter = await prisma.rentalWebhookOutbox.findUniqueOrThrow({
      where: { id: failedEntry.id },
    });

    expect(deadLetter.status).toBe(RentalWebhookOutboxStatus.DEAD_LETTER);
    expect(deadLetter.attempts).toBe(2);
    expect(deadLetter.lastStatusCode).toBe(429);
  });
});
