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
import { prisma, TenantWebhookOutboxStatus } from '@sync-erp/database';
import { webhookService } from '@src/services/webhook.service';
import { tenantWebhookOutboxService } from '@src/services/tenant-webhook-outbox.service';

const COMPANY_ID = 'test-tenant-webhook-service-001';

const cleanup = async () => {
  await prisma.tenantWebhookOutbox.deleteMany({
    where: { companyId: COMPANY_ID },
  });
  await prisma.apiKey.deleteMany({ where: { companyId: COMPANY_ID } });
};

describe('WebhookService', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeAll(async () => {
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Tenant Webhook Service Test Company',
      },
      update: {
        name: 'Tenant Webhook Service Test Company',
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.company.deleteMany({ where: { id: COMPANY_ID } });
  });

  beforeEach(async () => {
    process.env.TENANT_WEBHOOK_MAX_ATTEMPTS = '3';
    process.env.TENANT_WEBHOOK_RETRY_BASE_MS = '1';
    process.env.TENANT_WEBHOOK_RETRY_MAX_MS = '2';

    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();

    await cleanup();
    await prisma.apiKey.create({
      data: {
        keyHash: `test-key-hash-${Date.now()}-${Math.random()}`,
        keyPrefix: 'test-key',
        name: 'Webhook Service Test Key',
        companyId: COMPANY_ID,
        permissions: ['rental:read', 'rental:write'],
        webhookUrl: 'http://tenant-webhook.test/notify',
        webhookSecret: 'super-secret',
        isActive: true,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TENANT_WEBHOOK_MAX_ATTEMPTS;
    delete process.env.TENANT_WEBHOOK_RETRY_BASE_MS;
    delete process.env.TENANT_WEBHOOK_RETRY_MAX_MS;
  });

  it('persists transient HTTP failures for worker retry and later delivery', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

    const result = await webhookService.notifyPaymentEvent(
      COMPANY_ID,
      'payment.received',
      {
        id: 'order-1',
        orderNumber: 'RNT-001',
        rentalPaymentStatus: 'AWAITING_CONFIRM',
        totalAmount: 150000,
        paymentMethod: 'qris',
        paymentReference: 'tx-001',
      }
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(TenantWebhookOutboxStatus.FAILED);
    expect(result.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const failedEntry = await prisma.tenantWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        event: 'payment.received',
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

    expect(failedEntry.status).toBe(TenantWebhookOutboxStatus.FAILED);

    await prisma.tenantWebhookOutbox.update({
      where: { id: failedEntry.id },
      data: {
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);

    const summary = await tenantWebhookOutboxService.processDueEntries();
    expect(summary.delivered).toBeGreaterThanOrEqual(1);

    const deliveredEntry = await prisma.tenantWebhookOutbox.findUniqueOrThrow({
      where: { id: failedEntry.id },
    });

    expect(deliveredEntry.status).toBe(TenantWebhookOutboxStatus.DELIVERED);
  });

  it('does not retry permanent HTTP failures', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
    } as Response);

    const result = await webhookService.notifyOrderEvent(
      COMPANY_ID,
      'order.created',
      {
        id: 'order-2',
        orderNumber: 'RNT-002',
        status: 'DRAFT',
        totalAmount: 200000,
      }
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(TenantWebhookOutboxStatus.DEAD_LETTER);
    expect(result.statusCode).toBe(400);
    expect(result.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('persists network errors as FAILED for asynchronous retry', async () => {
    fetchMock.mockRejectedValue(new Error('Network down'));

    const result = await webhookService.notifyTenant(
      COMPANY_ID,
      'payment.received',
      {
        orderId: 'order-3',
        amount: 100000,
      }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network down');
    expect(result.status).toBe(TenantWebhookOutboxStatus.FAILED);
    expect(result.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats HTTP 429 as retryable and dead-letters after max attempts', async () => {
    process.env.TENANT_WEBHOOK_MAX_ATTEMPTS = '2';

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
    } as Response);

    const firstAttempt = await webhookService.notifyTenant(
      COMPANY_ID,
      'payment.received',
      {
        orderId: 'order-429',
        amount: 125000,
      }
    );

    expect(firstAttempt.success).toBe(false);
    expect(firstAttempt.status).toBe(TenantWebhookOutboxStatus.FAILED);
    expect(firstAttempt.statusCode).toBe(429);

    const queued = await prisma.tenantWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        event: 'payment.received',
        payload: {
          path: ['orderId'],
          equals: 'order-429',
        },
      },
    });

    await prisma.tenantWebhookOutbox.update({
      where: { id: queued.id },
      data: {
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
    } as Response);

    const summary = await tenantWebhookOutboxService.processDueEntries();
    expect(summary).toMatchObject({
      processed: 1,
      delivered: 0,
      failed: 0,
      deadLettered: 1,
    });

    const exhausted = await prisma.tenantWebhookOutbox.findUniqueOrThrow({
      where: { id: queued.id },
    });

    expect(exhausted.status).toBe(TenantWebhookOutboxStatus.DEAD_LETTER);
    expect(exhausted.attempts).toBe(2);
    expect(exhausted.lastStatusCode).toBe(429);
  });

  it('treats timeout errors as retryable and dead-letters after max attempts', async () => {
    process.env.TENANT_WEBHOOK_MAX_ATTEMPTS = '2';

    fetchMock.mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));

    const firstAttempt = await webhookService.notifyOrderEvent(
      COMPANY_ID,
      'order.created',
      {
        id: 'order-timeout',
        orderNumber: 'RNT-TIMEOUT-001',
        status: 'DRAFT',
        totalAmount: 210000,
      }
    );

    expect(firstAttempt.success).toBe(false);
    expect(firstAttempt.status).toBe(TenantWebhookOutboxStatus.FAILED);
    expect(firstAttempt.error).toContain('timeout');

    const queued = await prisma.tenantWebhookOutbox.findFirstOrThrow({
      where: {
        companyId: COMPANY_ID,
        event: 'order.created',
        payload: {
          path: ['orderId'],
          equals: 'order-timeout',
        },
      },
    });

    await prisma.tenantWebhookOutbox.update({
      where: { id: queued.id },
      data: {
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    });

    fetchMock.mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));

    const summary = await tenantWebhookOutboxService.processDueEntries();
    expect(summary).toMatchObject({
      processed: 1,
      delivered: 0,
      failed: 0,
      deadLettered: 1,
    });

    const exhausted = await prisma.tenantWebhookOutbox.findUniqueOrThrow({
      where: { id: queued.id },
    });

    expect(exhausted.status).toBe(TenantWebhookOutboxStatus.DEAD_LETTER);
    expect(exhausted.attempts).toBe(2);
    expect(exhausted.lastStatusCode).toBeNull();
    expect(exhausted.lastError).toContain('timeout');
  });
});
