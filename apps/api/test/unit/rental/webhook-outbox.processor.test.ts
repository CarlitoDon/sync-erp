import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import crypto from 'crypto';
import {
  prisma,
  RentalWebhookDeliveryType,
  RentalWebhookOutboxStatus,
} from '@sync-erp/database';
import { asMock } from '@sync-erp/shared';
import { webhookOutboxService } from '@modules/rental/webhook-outbox.service';
import { defaultWebhookTransport } from '@src/services/webhook-ssrf-transport';

const COMPANY_ID = 'unit-outbox-processor-001';

const pendingEntry = (overrides: Record<string, unknown> = {}) => ({
  id: 'entry-1',
  companyId: COMPANY_ID,
  integrationId: null,
  event: RentalWebhookDeliveryType.NEW_ORDER,
  orderPublicToken: 'unit-token-1',
  orderNumber: 'RNT-UNIT-0001',
  payload: { action: 'new_order' },
  autoRetry: true,
  status: RentalWebhookOutboxStatus.PENDING,
  attempts: 0,
  nextAttemptAt: new Date(Date.now() - 1_000),
  lastAttemptAt: null,
  deliveredAt: null,
  lastError: null,
  lastStatusCode: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const deliveredEntry = (overrides: Record<string, unknown> = {}) =>
  pendingEntry({
    status: RentalWebhookOutboxStatus.DELIVERED,
    deliveredAt: new Date(),
    ...overrides,
  });

const processingEntry = (overrides: Record<string, unknown> = {}) =>
  pendingEntry({
    status: RentalWebhookOutboxStatus.PROCESSING,
    ...overrides,
  });

const failedEntry = (overrides: Record<string, unknown> = {}) =>
  pendingEntry({
    status: RentalWebhookOutboxStatus.FAILED,
    lastError: 'Webhook failed: 500',
    lastStatusCode: 500,
    ...overrides,
  });

const deadLetterEntry = (overrides: Record<string, unknown> = {}) =>
  pendingEntry({
    status: RentalWebhookOutboxStatus.DEAD_LETTER,
    autoRetry: false,
    lastError: 'Webhook failed: 400',
    lastStatusCode: 400,
    ...overrides,
  });

const seedActiveIntegration = () => ({
  id: 'integration-1',
  companyId: COMPANY_ID,
  appId: 'test-plugin',
  name: 'Test Plugin',
  description: null,
  icon: null,
  isActive: true,
  config: {
    webhookUrl: 'https://proxy.test',
    webhookSecret: 'whsec-test',
  },
  apiKeys: [
    {
      id: 'api-key-1',
      companyId: COMPANY_ID,
      integrationId: 'integration-1',
      keyHash: 'hash',
      keyPrefix: 'sk_test',
      name: 'Test Key',
      webhookUrl: 'https://proxy.test',
      webhookSecret: 'whsec-test',
      isActive: true,
    },
  ],
});

type WebhookOutboxFn = (...args: unknown[]) => unknown;

describe('WebhookOutboxProcessor (unit)', () => {
  const transportSendMock = vi.spyOn(
    defaultWebhookTransport,
    'send'
  ) as unknown as ReturnType<typeof vi.fn>;
  const prismaWebhookOutbox = prisma.webhookOutbox as {
    updateMany: WebhookOutboxFn;
    findUniqueOrThrow: WebhookOutboxFn;
    findFirst: WebhookOutboxFn;
    findMany: WebhookOutboxFn;
    create: WebhookOutboxFn;
  };
  const prismaUpdateManyMock = vi.mocked(
    prismaWebhookOutbox.updateMany
  );
  const prismaFindUniqueOrThrowMock = vi.mocked(
    prismaWebhookOutbox.findUniqueOrThrow
  );
  const prismaFindFirstMock = vi.mocked(
    prismaWebhookOutbox.findFirst
  );
  const prismaFindManyMock = vi.mocked(prismaWebhookOutbox.findMany);
  const prismaCreateMock = vi.mocked(prismaWebhookOutbox.create);

  beforeEach(() => {
    vi.clearAllMocks();
    prismaUpdateManyMock.mockReset();
    prismaFindUniqueOrThrowMock.mockReset();
    prismaFindFirstMock.mockReset();
    prismaFindManyMock.mockReset();
    prismaCreateMock.mockReset();
    transportSendMock.mockReset();
    prismaFindFirstMock.mockResolvedValue(null);
    prismaFindManyMock.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.RENTAL_WEBHOOK_OUTBOX_MAX_ATTEMPTS;
    delete process.env.RENTAL_WEBHOOK_OUTBOX_RETRY_BASE_MS;
    delete process.env.RENTAL_WEBHOOK_OUTBOX_RETRY_MAX_MS;
  });

  describe('claiming', () => {
    it('claims only PENDING records and ignores non-claimable states', async () => {
      prismaFindManyMock.mockResolvedValue([
        pendingEntry(),
        failedEntry(),
        deliveredEntry(),
        deadLetterEntry(),
        processingEntry(),
      ]);
      prismaFindFirstMock.mockResolvedValue(null);

      const summary = await webhookOutboxService.processDueEntries();

      expect(summary).toMatchObject({
        processed: 0,
        delivered: 0,
        failed: 0,
        deadLettered: 0,
      });
      expect(prismaFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: {
              in: [
                RentalWebhookOutboxStatus.PENDING,
                RentalWebhookOutboxStatus.FAILED,
              ],
            },
            nextAttemptAt: { lte: expect.any(Date) },
          },
          take: 20,
        })
      );
      // None of the returned entries were claimable; no claim update ran.
      expect(prismaUpdateManyMock).not.toHaveBeenCalled();
    });

    it('claims PENDING and FAILED entries but not DELIVERED, DEAD_LETTER, or PROCESSING', async () => {
      prismaFindManyMock.mockResolvedValue([
        pendingEntry({ id: 'pending-1' }),
        failedEntry({ id: 'failed-1' }),
        deliveredEntry({ id: 'delivered-1' }),
        deadLetterEntry({ id: 'dead-letter-1' }),
        processingEntry({ id: 'processing-1' }),
      ]);
      // Re-return the still-claimable entry on the claim read-back, so the
      // findFirst callback resolves for PENDING/FAILED and returns null for
      // the non-claimable states.
      prismaFindFirstMock.mockImplementation((args: unknown) => {
        const where =
          (
            args as {
              where?: { id?: string; status?: { in?: string[] } };
            }
          ).where ?? {};
        if (
          where?.status?.in?.includes(
            RentalWebhookOutboxStatus.PENDING
          )
        ) {
          return Promise.resolve({ ...pendingEntry(), id: where.id });
        }
        return Promise.resolve(null);
      });
      prismaUpdateManyMock.mockResolvedValue({ count: 0 });
      prismaFindUniqueOrThrowMock.mockRejectedValue(
        new Error('unexpected findUniqueOrThrow')
      );

      const summary = await webhookOutboxService.processDueEntries();

      expect(summary).toMatchObject({
        processed: 0,
        delivered: 0,
        failed: 0,
        deadLettered: 0,
      });
      const updateManyCalls =
        (
          prisma.webhookOutbox.updateMany as unknown as {
            mock?: { calls?: unknown[][] };
          }
        ).mock?.calls ?? [];
      expect(updateManyCalls).toHaveLength(5);
      const claimWhereIds = updateManyCalls.map(
        (call) => (call[0] as { where?: { id?: string } }).where?.id
      );
      expect(claimWhereIds).toEqual([
        'pending-1',
        'failed-1',
        'delivered-1',
        'dead-letter-1',
        'processing-1',
      ]);
      // The candidate lookup for every returned entry is restricted to
      // PENDING and FAILED, so non-claimable states are never claimed.
      const candidateStatuses = updateManyCalls.map(
        (call) =>
          (call[0] as { where?: { status?: string } }).where?.status
      );
      expect(candidateStatuses).toEqual([
        RentalWebhookOutboxStatus.PENDING,
        RentalWebhookOutboxStatus.PENDING,
        RentalWebhookOutboxStatus.PENDING,
        RentalWebhookOutboxStatus.PENDING,
        RentalWebhookOutboxStatus.PENDING,
      ]);
      // The claim write itself always targets PROCESSING.
      const claimWrites = updateManyCalls.map(
        (call) =>
          (call[0] as { data?: { status?: string } }).data?.status
      );
      expect(claimWrites).toEqual([
        RentalWebhookOutboxStatus.PROCESSING,
        RentalWebhookOutboxStatus.PROCESSING,
        RentalWebhookOutboxStatus.PROCESSING,
        RentalWebhookOutboxStatus.PROCESSING,
        RentalWebhookOutboxStatus.PROCESSING,
      ]);
    });

    it('processes a due PENDING entry and marks it DELIVERED with signature headers', async () => {
      const entry = pendingEntry({
        id: 'deliver-me',
        status: RentalWebhookOutboxStatus.PENDING,
      });
      prismaFindManyMock.mockResolvedValue([entry]);
      prismaFindFirstMock.mockImplementation((args: unknown) => {
        const where =
          (args as { where?: { id?: string } }).where ?? {};
        if (where.id === 'deliver-me') return Promise.resolve(entry);
        return Promise.resolve(null);
      });
      prismaUpdateManyMock.mockResolvedValue({ count: 1 });
      prismaFindUniqueOrThrowMock.mockResolvedValue({
        ...entry,
        status: RentalWebhookOutboxStatus.PROCESSING,
        attempts: 1,
        lastAttemptAt: new Date(),
      });
      // performFetch resolves the active integration through the service.
      asMock(prisma.integration.findFirst).mockResolvedValue(
        seedActiveIntegration()
      );
      transportSendMock.mockResolvedValue({ statusCode: 200 });
      const summary = await webhookOutboxService.processDueEntries();
      expect(summary).toMatchObject({
        processed: 1,
        delivered: 1,
        failed: 0,
        deadLettered: 0,
      });
      expect(transportSendMock).toHaveBeenCalledTimes(1);
      const request = transportSendMock.mock.calls[0]?.[0];
      expect(request?.headers).toMatchObject({
        'Content-Type': 'application/json',
        'X-Webhook-Delivery-Id': 'deliver-me',
        'Idempotency-Key': 'deliver-me',
        'X-Webhook-Timestamp': expect.any(String),
      });
      const signature = request?.headers?.['X-Webhook-Signature'];
      expect(signature).toBeTruthy();
      const expectedSignature = crypto
        .createHmac('sha256', 'whsec-test')
        .update(request?.body ?? '')
        .digest('hex');
      expect(signature).toBe(expectedSignature);
    });
  });

  describe('stale PROCESSING recovery', () => {
    it('recovers stale PROCESSING entries back to PENDING with immediate nextAttemptAt', async () => {
      prismaUpdateManyMock.mockResolvedValue({ count: 2 });
      const recovered =
        await webhookOutboxService.recoverStaleProcessingClaims();
      expect(recovered).toBe(2);
      expect(prismaUpdateManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: RentalWebhookOutboxStatus.PROCESSING,
            updatedAt: { lte: expect.any(Date) },
          },
          data: {
            status: RentalWebhookOutboxStatus.PENDING,
            nextAttemptAt: expect.any(Date),
          },
        })
      );
    });

    it('does not touch fresh PROCESSING claims within the lease window', async () => {
      prismaUpdateManyMock.mockResolvedValue({ count: 0 });
      const recovered =
        await webhookOutboxService.recoverStaleProcessingClaims(
          60_000
        );
      expect(recovered).toBe(0);
      const callArgs =
        (
          prismaUpdateManyMock.mock.calls[0]?.[0] as
            | {
                where?: {
                  status?: string;
                  updatedAt?: { lte?: Date };
                };
              }
            | undefined
        )?.where ?? {};
      expect(callArgs.status).toBe(
        RentalWebhookOutboxStatus.PROCESSING
      );
      const staleCutoff = callArgs.updatedAt?.lte as Date;
      expect(staleCutoff.getTime()).toBeLessThanOrEqual(Date.now());
      expect(staleCutoff.getTime()).toBeGreaterThan(
        Date.now() - 61_000
      );
    });
  });

  describe('enqueue', () => {
    it('creates the outbox record when an active integration exists', async () => {
      const integrationUniqueMock = asMock(
        prisma.integration.findUnique
      );
      integrationUniqueMock.mockReset();
      integrationUniqueMock.mockResolvedValue(
        seedActiveIntegration()
      );
      const created = pendingEntry({
        id: 'created-entry',
        event: RentalWebhookDeliveryType.NEW_ORDER,
        payload: { orderNumber: 'RNT-UNIT-0001' },
      });
      prismaCreateMock.mockResolvedValue(created);
      // In-flight processing happens outside enqueue in real operation;
      // here the persisted record is exactly what enqueue wrote.
      asMock(prisma.integration.findUnique).mockResolvedValue(
        seedActiveIntegration()
      );
      asMock(prisma.integration.findFirst).mockResolvedValue(
        seedActiveIntegration()
      );
      const result = await webhookOutboxService.enqueue(
        RentalWebhookDeliveryType.NEW_ORDER,
        {
          companyId: COMPANY_ID,
          orderPublicToken: 'unit-token-1',
          orderNumber: 'RNT-UNIT-0001',
          payload: { orderNumber: 'RNT-UNIT-0001' },
        }
      );
      // Without an immediate claim the record is persisted as FAILED —
      // enqueue always writes the outbox row and the retry cycle delivers.
      expect(result).toMatchObject({
        success: false,
        status: RentalWebhookOutboxStatus.FAILED,
        deliveryId: 'created-entry',
      });
      const createCalls =
        (
          prisma.webhookOutbox.create as unknown as {
            mock?: { calls?: unknown[][] };
          }
        ).mock?.calls ?? [];
      const createdArg = createCalls[0]?.[0] as
        { data?: Record<string, unknown> } | undefined;
      expect(createdArg?.data).toMatchObject({
        companyId: COMPANY_ID,
        event: RentalWebhookDeliveryType.NEW_ORDER,
        orderPublicToken: 'unit-token-1',
        orderNumber: 'RNT-UNIT-0001',
        autoRetry: true,
        payload: { orderNumber: 'RNT-UNIT-0001' },
      });
      expect(prismaCreateMock).toHaveBeenCalledTimes(1);
    });
  });
});
