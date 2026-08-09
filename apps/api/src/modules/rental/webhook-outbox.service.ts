import {
  prisma,
  Prisma,
  RentalWebhookDeliveryType,
  RentalWebhookOutboxStatus,
} from '@sync-erp/database';
import { WEBHOOK_TIMEOUT_MS } from '@sync-erp/shared';
import {
  isRetryableStatusCode,
  readPositiveInt,
} from '../../services/webhook-outbox-config';
import {
  defaultWebhookTransport,
  describeWebhookError,
  WebhookSecurityError,
  type WebhookTransport,
} from '../../services/webhook-ssrf-transport';
import { integrationService } from '../../services/integration.service';
import { integrationRegistry } from '../../integrations/registry';

type DeliveryResult = {
  success: boolean;
  deliveryId: string;
  status: RentalWebhookOutboxStatus;
  attempts: number;
  statusCode?: number;
  error?: string;
  skipped?: boolean;
};

type ProcessSummary = {
  processed: number;
  delivered: number;
  failed: number;
  deadLettered: number;
};

export type OutboxQueueCounts = {
  pending: number;
  processing: number;
  failed: number;
  deadLetter: number;
};

export type OutboxHealthSignal = {
  healthy: boolean;
  deadLetterCount: number;
  deadLetterWarnThreshold: number;
  reason?: string;
};

type FetchFailure = {
  success: false;
  permanent: boolean;
  error: string;
  statusCode?: number;
};

type FetchSuccess = {
  success: true;
  statusCode: number;
};

type FetchResult = FetchSuccess | FetchFailure;

const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_RETRY_BASE_MS = 30_000;
const DEFAULT_RETRY_MAX_MS = 15 * 60_000;
const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_DEAD_LETTER_WARN_THRESHOLD = 20;

const webhookEventForDeliveryType = (
  deliveryType: RentalWebhookDeliveryType
) => {
  switch (deliveryType) {
    case RentalWebhookDeliveryType.NEW_ORDER:
      return 'order.created';
    case RentalWebhookDeliveryType.PAYMENT_STATUS:
      return 'payment.status.changed';
  }
};

const asObject = (value: Prisma.JsonValue) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, Prisma.JsonValue>;
  }
  return {} as Record<string, Prisma.JsonValue>;
};

const readString = (
  payload: Record<string, Prisma.JsonValue>,
  key: string
) => {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
};

export class WebhookOutboxService {
  constructor(
    private readonly transport: WebhookTransport = defaultWebhookTransport
  ) {}

  async enqueue(
    deliveryType: RentalWebhookDeliveryType,
    input: {
      companyId: string;
      integrationId?: string;
      orderPublicToken: string;
      orderNumber?: string;
      payload: unknown;
      autoRetry?: boolean;
    }
  ): Promise<DeliveryResult> {
    const activeIntegration = input.integrationId
      ? await prisma.integration.findUnique({
          where: { id: input.integrationId },
        })
      : await integrationService.getActiveIntegrationForCompany(
          input.companyId
        );

    if (!activeIntegration) {
      return {
        success: true,
        deliveryId: '',
        status: RentalWebhookOutboxStatus.DELIVERED,
        attempts: 0,
        skipped: true,
      };
    }

    const delivery = await prisma.rentalWebhookOutbox.create({
      data: {
        companyId: input.companyId,
        deliveryType,
        orderPublicToken: input.orderPublicToken,
        orderNumber: input.orderNumber,
        autoRetry: input.autoRetry ?? true,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });

    return (
      (await this.processDelivery(delivery.id)) ?? {
        success: false,
        deliveryId: delivery.id,
        status: RentalWebhookOutboxStatus.FAILED,
        attempts: delivery.attempts,
        error: 'Delivery was not claimable',
      }
    );
  }

  async processDueEntries(limit = 20): Promise<ProcessSummary> {
    const dueEntries = await prisma.rentalWebhookOutbox.findMany({
      where: {
        status: {
          in: [
            RentalWebhookOutboxStatus.PENDING,
            RentalWebhookOutboxStatus.FAILED,
          ],
        },
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    });

    const summary: ProcessSummary = {
      processed: 0,
      delivered: 0,
      failed: 0,
      deadLettered: 0,
    };

    for (const entry of dueEntries) {
      const result = await this.processDelivery(entry.id);
      if (!result) {
        continue;
      }

      summary.processed += 1;

      if (result.status === RentalWebhookOutboxStatus.DELIVERED) {
        summary.delivered += 1;
        continue;
      }

      if (result.status === RentalWebhookOutboxStatus.DEAD_LETTER) {
        summary.deadLettered += 1;
        continue;
      }

      summary.failed += 1;
    }

    if (summary.processed > 0) {
      const queueCounts = await this.getQueueCounts();
      console.warn('[WebhookOutbox] Retry cycle summary', {
        ...summary,
        queue: queueCounts,
      });

      const deadLetterThreshold = readPositiveInt(
        process.env.RENTAL_WEBHOOK_OUTBOX_DEAD_LETTER_WARN_THRESHOLD,
        DEFAULT_DEAD_LETTER_WARN_THRESHOLD
      );

      if (queueCounts.deadLetter >= deadLetterThreshold) {
        console.warn(
          '[WebhookOutbox] Dead-letter queue exceeds threshold',
          {
            deadLetterCount: queueCounts.deadLetter,
            threshold: deadLetterThreshold,
          }
        );
      }
    }

    return summary;
  }

  async getQueueCounts(
    companyId?: string
  ): Promise<OutboxQueueCounts> {
    const where = companyId ? { companyId } : {};

    const [pending, processing, failed, deadLetter] =
      await Promise.all([
        prisma.rentalWebhookOutbox.count({
          where: {
            ...where,
            status: RentalWebhookOutboxStatus.PENDING,
          },
        }),
        prisma.rentalWebhookOutbox.count({
          where: {
            ...where,
            status: RentalWebhookOutboxStatus.PROCESSING,
          },
        }),
        prisma.rentalWebhookOutbox.count({
          where: {
            ...where,
            status: RentalWebhookOutboxStatus.FAILED,
          },
        }),
        prisma.rentalWebhookOutbox.count({
          where: {
            ...where,
            status: RentalWebhookOutboxStatus.DEAD_LETTER,
          },
        }),
      ]);

    return { pending, processing, failed, deadLetter };
  }

  async getHealthSignal(
    companyId?: string
  ): Promise<OutboxHealthSignal> {
    const counts = await this.getQueueCounts(companyId);
    const deadLetterWarnThreshold = readPositiveInt(
      process.env.RENTAL_WEBHOOK_OUTBOX_DEAD_LETTER_WARN_THRESHOLD,
      DEFAULT_DEAD_LETTER_WARN_THRESHOLD
    );
    const healthy = counts.deadLetter < deadLetterWarnThreshold;

    return {
      healthy,
      deadLetterCount: counts.deadLetter,
      deadLetterWarnThreshold,
      ...(healthy
        ? {}
        : { reason: 'Dead-letter queue exceeded warning threshold' }),
    };
  }

  async listDeliveries(input: {
    companyId: string;
    statuses?: RentalWebhookOutboxStatus[];
    deliveryType?: RentalWebhookDeliveryType;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);

    const where: Prisma.RentalWebhookOutboxWhereInput = {
      companyId: input.companyId,
      ...(input.statuses?.length
        ? { status: { in: input.statuses } }
        : {}),
      ...(input.deliveryType
        ? { deliveryType: input.deliveryType }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.rentalWebhookOutbox.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
      prisma.rentalWebhookOutbox.count({ where }),
    ]);

    return { data, pagination: { total, limit, offset } };
  }

  async getDeliveryDetail(input: { companyId: string; id: string }) {
    return prisma.rentalWebhookOutbox.findFirst({
      where: { id: input.id, companyId: input.companyId },
    });
  }

  async requeueDelivery(
    id: string,
    options?: { companyId?: string }
  ): Promise<boolean> {
    const where: Prisma.RentalWebhookOutboxWhereInput = {
      id,
      ...(options?.companyId ? { companyId: options.companyId } : {}),
    };

    const entry = await prisma.rentalWebhookOutbox.findFirst({ where });
    if (!entry) return false;

    if (
      entry.status !== RentalWebhookOutboxStatus.FAILED &&
      entry.status !== RentalWebhookOutboxStatus.DEAD_LETTER
    ) {
      return false;
    }

    await prisma.rentalWebhookOutbox.update({
      where: { id: entry.id },
      data: {
        status: RentalWebhookOutboxStatus.PENDING,
        nextAttemptAt: new Date(),
        lastError: null,
        lastStatusCode: null,
        autoRetry: true,
      },
    });

    return true;
  }

  async requeueDeliveries(input: {
    companyId: string;
    ids?: string[];
    statuses?: RentalWebhookOutboxStatus[];
    limit?: number;
  }): Promise<number> {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
    const filterStatuses = input.statuses?.length
      ? input.statuses
      : [
          RentalWebhookOutboxStatus.FAILED,
          RentalWebhookOutboxStatus.DEAD_LETTER,
        ];

    const candidates = await prisma.rentalWebhookOutbox.findMany({
      where: {
        companyId: input.companyId,
        status: { in: filterStatuses },
        ...(input.ids?.length ? { id: { in: input.ids } } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
      select: { id: true },
    });

    if (candidates.length === 0) return 0;

    const result = await prisma.rentalWebhookOutbox.updateMany({
      where: { id: { in: candidates.map((item) => item.id) } },
      data: {
        status: RentalWebhookOutboxStatus.PENDING,
        nextAttemptAt: new Date(),
        lastError: null,
        lastStatusCode: null,
        autoRetry: true,
      },
    });

    return result.count;
  }

  private async processDelivery(
    id: string
  ): Promise<DeliveryResult | null> {
    const claimedEntry = await this.claimDelivery(id);
    if (!claimedEntry) return null;

    const fetchResult = await this.performFetch(claimedEntry);

    if (fetchResult.success) {
      await prisma.rentalWebhookOutbox.update({
        where: { id: claimedEntry.id },
        data: {
          status: RentalWebhookOutboxStatus.DELIVERED,
          deliveredAt: new Date(),
          lastError: null,
          lastStatusCode: fetchResult.statusCode,
        },
      });

      return {
        success: true,
        deliveryId: claimedEntry.id,
        status: RentalWebhookOutboxStatus.DELIVERED,
        attempts: claimedEntry.attempts,
        statusCode: fetchResult.statusCode,
      };
    }

    const nextStatus = this.resolveFailureStatus(
      claimedEntry.autoRetry,
      claimedEntry.attempts,
      fetchResult.permanent
    );

    await prisma.rentalWebhookOutbox.update({
      where: { id: claimedEntry.id },
      data: {
        status: nextStatus,
        nextAttemptAt:
          nextStatus === RentalWebhookOutboxStatus.FAILED
            ? new Date(
                Date.now() +
                  this.calculateBackoffMs(claimedEntry.attempts)
              )
            : new Date(),
        lastError: fetchResult.error,
        lastStatusCode: fetchResult.statusCode ?? null,
      },
    });

    return {
      success: false,
      deliveryId: claimedEntry.id,
      status: nextStatus,
      attempts: claimedEntry.attempts,
      statusCode: fetchResult.statusCode,
      error: fetchResult.error,
    };
  }

  private async claimDelivery(id: string) {
    const candidate = await prisma.rentalWebhookOutbox.findFirst({
      where: {
        id,
        status: {
          in: [
            RentalWebhookOutboxStatus.PENDING,
            RentalWebhookOutboxStatus.FAILED,
          ],
        },
      },
    });

    if (!candidate) return null;

    const claimed = await prisma.rentalWebhookOutbox.updateMany({
      where: { id: candidate.id, status: candidate.status },
      data: {
        status: RentalWebhookOutboxStatus.PROCESSING,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });

    if (claimed.count === 0) return null;

    return prisma.rentalWebhookOutbox.findUniqueOrThrow({
      where: { id: candidate.id },
    });
  }

  private resolveFailureStatus(
    autoRetry: boolean,
    attempts: number,
    permanent: boolean
  ) {
    const maxAttempts = readPositiveInt(
      process.env.RENTAL_WEBHOOK_OUTBOX_MAX_ATTEMPTS,
      DEFAULT_MAX_ATTEMPTS
    );
    if (!autoRetry || permanent || attempts >= maxAttempts) {
      return RentalWebhookOutboxStatus.DEAD_LETTER;
    }
    return RentalWebhookOutboxStatus.FAILED;
  }

  private calculateBackoffMs(attempts: number) {
    const retryBaseMs = readPositiveInt(
      process.env.RENTAL_WEBHOOK_OUTBOX_RETRY_BASE_MS,
      DEFAULT_RETRY_BASE_MS
    );
    const retryMaxMs = readPositiveInt(
      process.env.RENTAL_WEBHOOK_OUTBOX_RETRY_MAX_MS,
      DEFAULT_RETRY_MAX_MS
    );
    return Math.min(
      retryBaseMs * 2 ** Math.max(attempts - 1, 0),
      retryMaxMs
    );
  }

  private async performFetch(entry: {
    id: string;
    deliveryType: RentalWebhookDeliveryType;
    orderPublicToken: string;
    orderNumber: string | null;
    payload: Prisma.JsonValue;
    companyId: string;
  }): Promise<FetchResult> {
    const activeIntegration =
      await integrationService.getActiveIntegrationForCompany(
        entry.companyId
      );

    if (!activeIntegration) {
      return {
        success: false,
        permanent: true,
        error: 'No active integration configured',
      };
    }

    const integrationConfig = asObject(
      activeIntegration.config as Prisma.JsonValue
    );
    const apiKey = activeIntegration.apiKeys[0];

    const baseUrl = (
      (apiKey?.webhookUrl as string | undefined) ||
      readString(integrationConfig, 'webhookUrl') ||
      ''
    ).replace(/\/$/, '');

    const secret =
      (apiKey?.webhookSecret as string | undefined) ||
      readString(integrationConfig, 'webhookSecret') ||
      '';

    if (!baseUrl) {
      return {
        success: false,
        permanent: true,
        error: 'Webhook base URL not configured',
      };
    }

    if (!secret) {
      return {
        success: false,
        permanent: true,
        error: 'Webhook secret not configured',
      };
    }

    const plugin = integrationRegistry.get(activeIntegration.appId);
    const event = webhookEventForDeliveryType(entry.deliveryType);

    let requestBody = entry.payload;
    if (plugin?.buildWebhookPayload) {
      requestBody = plugin.buildWebhookPayload(
        event,
        entry.payload,
        integrationConfig
      ) as Prisma.JsonValue;
    }

    let urlPath = '/api/webhook';
    if (plugin?.getWebhookPath) {
      urlPath = plugin.getWebhookPath(
        event,
        entry.orderPublicToken,
        integrationConfig
      );
    }

    const url = `${baseUrl}${urlPath}`;

    try {
      const response = await this.transport.send({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: secret,
          'X-Webhook-Delivery-Id': entry.id,
          'Idempotency-Key': entry.id,
        },
        body: JSON.stringify(requestBody),
        timeoutMs: WEBHOOK_TIMEOUT_MS,
      });

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return { success: true, statusCode: response.statusCode };
      }

      return {
        success: false,
        permanent: !isRetryableStatusCode(response.statusCode),
        statusCode: response.statusCode,
        error: `Webhook failed: ${response.statusCode}`,
      };
    } catch (error) {
      return {
        success: false,
        permanent: error instanceof WebhookSecurityError,
        error: describeWebhookError(error),
      };
    }
  }
}

export const webhookOutboxService = new WebhookOutboxService();

export const startWebhookOutboxWorker = () => {
  const pollIntervalMs = readPositiveInt(
    process.env.RENTAL_WEBHOOK_OUTBOX_POLL_INTERVAL_MS,
    DEFAULT_POLL_INTERVAL_MS
  );
  let isRunning = false;

  const run = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await webhookOutboxService.processDueEntries();
    } catch (error) {
      console.error(
        '[WebhookOutbox] Worker failed to process due entries:',
        error
      );
    } finally {
      isRunning = false;
    }
  };

  const timer = setInterval(() => {
    void run();
  }, pollIntervalMs);
  timer.unref();
  void run();

  return () => {
    clearInterval(timer);
  };
};
