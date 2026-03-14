import crypto from 'crypto';
import {
  prisma,
  Prisma,
  TenantWebhookOutboxStatus,
} from '@sync-erp/database';
import { WEBHOOK_TIMEOUT_MS } from '@sync-erp/shared';
import {
  isRetryableStatusCode,
  readPositiveInt,
} from './webhook-outbox-config';

export type TenantWebhookDeliveryResult = {
  success: boolean;
  deliveryId?: string;
  status?: TenantWebhookOutboxStatus;
  statusCode?: number;
  error?: string;
  duration?: number;
  attempts?: number;
};

type ProcessSummary = {
  processed: number;
  delivered: number;
  failed: number;
  deadLettered: number;
};

export type TenantWebhookOutboxQueueCounts = {
  pending: number;
  processing: number;
  failed: number;
  deadLetter: number;
};

export type TenantWebhookOutboxHealthSignal = {
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
  duration: number;
};

type FetchSuccess = {
  success: true;
  statusCode: number;
  duration: number;
};

type FetchResult = FetchSuccess | FetchFailure;

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 500;
const DEFAULT_RETRY_MAX_MS = 5_000;
const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_DEAD_LETTER_WARN_THRESHOLD = 20;

export class TenantWebhookOutboxService {
  async enqueueDelivery(input: {
    companyId: string;
    event: string;
    payload: Record<string, unknown>;
  }): Promise<TenantWebhookDeliveryResult> {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        companyId: input.companyId,
        isActive: true,
        webhookUrl: { not: null },
      },
      select: {
        id: true,
        webhookUrl: true,
        webhookSecret: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!apiKey?.webhookUrl) {
      return {
        success: false,
        error: 'No webhook URL configured',
        attempts: 0,
      };
    }

    const delivery = await prisma.tenantWebhookOutbox.create({
      data: {
        companyId: input.companyId,
        apiKeyId: apiKey.id,
        event: input.event,
        payload: input.payload as Prisma.InputJsonObject,
        webhookUrl: apiKey.webhookUrl,
        webhookSecret: apiKey.webhookSecret,
      },
    });

    const processed = await this.processDelivery(delivery.id);

    if (!processed) {
      return {
        success: false,
        deliveryId: delivery.id,
        error: 'Delivery was not claimable',
        attempts: delivery.attempts,
      };
    }

    return processed;
  }

  async processDueEntries(limit = 20): Promise<ProcessSummary> {
    const dueEntries = await prisma.tenantWebhookOutbox.findMany({
      where: {
        status: {
          in: [
            TenantWebhookOutboxStatus.PENDING,
            TenantWebhookOutboxStatus.FAILED,
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

      if (result.status === TenantWebhookOutboxStatus.DELIVERED) {
        summary.delivered += 1;
        continue;
      }

      if (result.status === TenantWebhookOutboxStatus.DEAD_LETTER) {
        summary.deadLettered += 1;
        continue;
      }

      summary.failed += 1;
    }

    if (summary.processed > 0) {
      const queueCounts = await this.getQueueCounts();
      console.warn('[TenantWebhookOutbox] Retry cycle summary', {
        ...summary,
        queue: queueCounts,
      });

      const deadLetterThreshold = this.getDeadLetterWarnThreshold();

      if (queueCounts.deadLetter >= deadLetterThreshold) {
        console.warn('[TenantWebhookOutbox] Dead-letter queue exceeds threshold', {
          deadLetterCount: queueCounts.deadLetter,
          threshold: deadLetterThreshold,
        });
      }
    }

    return summary;
  }

  async getQueueCounts(companyId?: string): Promise<TenantWebhookOutboxQueueCounts> {
    const where = companyId ? { companyId } : {};

    const [pending, processing, failed, deadLetter] = await Promise.all([
      prisma.tenantWebhookOutbox.count({
        where: {
          ...where,
          status: TenantWebhookOutboxStatus.PENDING,
        },
      }),
      prisma.tenantWebhookOutbox.count({
        where: {
          ...where,
          status: TenantWebhookOutboxStatus.PROCESSING,
        },
      }),
      prisma.tenantWebhookOutbox.count({
        where: {
          ...where,
          status: TenantWebhookOutboxStatus.FAILED,
        },
      }),
      prisma.tenantWebhookOutbox.count({
        where: {
          ...where,
          status: TenantWebhookOutboxStatus.DEAD_LETTER,
        },
      }),
    ]);

    return {
      pending,
      processing,
      failed,
      deadLetter,
    };
  }

  async getHealthSignal(companyId?: string): Promise<TenantWebhookOutboxHealthSignal> {
    const counts = await this.getQueueCounts(companyId);
    const deadLetterWarnThreshold = this.getDeadLetterWarnThreshold();
    const healthy = counts.deadLetter < deadLetterWarnThreshold;

    return {
      healthy,
      deadLetterCount: counts.deadLetter,
      deadLetterWarnThreshold,
      ...(healthy
        ? {}
        : {
            reason: 'Dead-letter queue exceeded warning threshold',
          }),
    };
  }

  async listDeliveries(input: {
    companyId: string;
    statuses?: TenantWebhookOutboxStatus[];
    event?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);

    const where: Prisma.TenantWebhookOutboxWhereInput = {
      companyId: input.companyId,
      ...(input.statuses?.length
        ? { status: { in: input.statuses } }
        : {}),
      ...(input.event ? { event: input.event } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.tenantWebhookOutbox.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
      prisma.tenantWebhookOutbox.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
      },
    };
  }

  async getDeliveryDetail(input: {
    companyId: string;
    id: string;
  }) {
    return prisma.tenantWebhookOutbox.findFirst({
      where: {
        id: input.id,
        companyId: input.companyId,
      },
    });
  }

  async requeueDelivery(id: string, options?: { companyId?: string }): Promise<boolean> {
    const where: Prisma.TenantWebhookOutboxWhereInput = {
      id,
      ...(options?.companyId
        ? { companyId: options.companyId }
        : {}),
    };

    const entry = await prisma.tenantWebhookOutbox.findFirst({ where });

    if (!entry) {
      return false;
    }

    if (
      entry.status !== TenantWebhookOutboxStatus.FAILED &&
      entry.status !== TenantWebhookOutboxStatus.DEAD_LETTER
    ) {
      return false;
    }

    await prisma.tenantWebhookOutbox.update({
      where: { id: entry.id },
      data: {
        status: TenantWebhookOutboxStatus.PENDING,
        nextAttemptAt: new Date(),
        lastError: null,
        lastStatusCode: null,
      },
    });

    return true;
  }

  async requeueDeliveries(input: {
    companyId: string;
    ids?: string[];
    statuses?: TenantWebhookOutboxStatus[];
    limit?: number;
  }): Promise<number> {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
    const filterStatuses =
      input.statuses && input.statuses.length > 0
        ? input.statuses
        : [
            TenantWebhookOutboxStatus.FAILED,
            TenantWebhookOutboxStatus.DEAD_LETTER,
          ];

    const candidates = await prisma.tenantWebhookOutbox.findMany({
      where: {
        companyId: input.companyId,
        status: {
          in: filterStatuses,
        },
        ...(input.ids?.length
          ? {
              id: {
                in: input.ids,
              },
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
      select: { id: true },
    });

    if (candidates.length === 0) {
      return 0;
    }

    const result = await prisma.tenantWebhookOutbox.updateMany({
      where: {
        id: { in: candidates.map((item) => item.id) },
      },
      data: {
        status: TenantWebhookOutboxStatus.PENDING,
        nextAttemptAt: new Date(),
        lastError: null,
        lastStatusCode: null,
      },
    });

    return result.count;
  }

  private getMaxAttempts() {
    return readPositiveInt(
      process.env.TENANT_WEBHOOK_OUTBOX_MAX_ATTEMPTS ||
        process.env.TENANT_WEBHOOK_MAX_ATTEMPTS,
      DEFAULT_MAX_ATTEMPTS
    );
  }

  private getRetryBaseMs() {
    return readPositiveInt(
      process.env.TENANT_WEBHOOK_OUTBOX_RETRY_BASE_MS ||
        process.env.TENANT_WEBHOOK_RETRY_BASE_MS,
      DEFAULT_RETRY_BASE_MS
    );
  }

  private getRetryMaxMs() {
    return readPositiveInt(
      process.env.TENANT_WEBHOOK_OUTBOX_RETRY_MAX_MS ||
        process.env.TENANT_WEBHOOK_RETRY_MAX_MS,
      DEFAULT_RETRY_MAX_MS
    );
  }

  private getDeadLetterWarnThreshold() {
    return readPositiveInt(
      process.env.TENANT_WEBHOOK_OUTBOX_DEAD_LETTER_WARN_THRESHOLD,
      DEFAULT_DEAD_LETTER_WARN_THRESHOLD
    );
  }

  private calculateBackoffMs(attempts: number) {
    return Math.min(
      this.getRetryBaseMs() * 2 ** Math.max(attempts - 1, 0),
      this.getRetryMaxMs()
    );
  }

  private async processDelivery(id: string): Promise<TenantWebhookDeliveryResult | null> {
    const claimedEntry = await this.claimDelivery(id);

    if (!claimedEntry) {
      return null;
    }

    const fetchResult = await this.performFetch(claimedEntry);

    if (fetchResult.success) {
      await prisma.tenantWebhookOutbox.update({
        where: { id: claimedEntry.id },
        data: {
          status: TenantWebhookOutboxStatus.DELIVERED,
          deliveredAt: new Date(),
          lastError: null,
          lastStatusCode: fetchResult.statusCode,
        },
      });

      return {
        success: true,
        deliveryId: claimedEntry.id,
        status: TenantWebhookOutboxStatus.DELIVERED,
        attempts: claimedEntry.attempts,
        statusCode: fetchResult.statusCode,
        duration: fetchResult.duration,
      };
    }

    const nextStatus = this.resolveFailureStatus(
      claimedEntry.attempts,
      fetchResult.permanent
    );

    await prisma.tenantWebhookOutbox.update({
      where: { id: claimedEntry.id },
      data: {
        status: nextStatus,
        nextAttemptAt:
          nextStatus === TenantWebhookOutboxStatus.FAILED
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
      duration: fetchResult.duration,
    };
  }

  private async claimDelivery(id: string) {
    const candidate = await prisma.tenantWebhookOutbox.findFirst({
      where: {
        id,
        status: {
          in: [
            TenantWebhookOutboxStatus.PENDING,
            TenantWebhookOutboxStatus.FAILED,
          ],
        },
      },
    });

    if (!candidate) {
      return null;
    }

    const now = new Date();
    const claimed = await prisma.tenantWebhookOutbox.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
      },
      data: {
        status: TenantWebhookOutboxStatus.PROCESSING,
        attempts: { increment: 1 },
        lastAttemptAt: now,
      },
    });

    if (claimed.count === 0) {
      return null;
    }

    return prisma.tenantWebhookOutbox.findUniqueOrThrow({
      where: { id: candidate.id },
    });
  }

  private resolveFailureStatus(attempts: number, permanent: boolean) {
    if (permanent || attempts >= this.getMaxAttempts()) {
      return TenantWebhookOutboxStatus.DEAD_LETTER;
    }

    return TenantWebhookOutboxStatus.FAILED;
  }

  private async performFetch(entry: {
    id: string;
    event: string;
    payload: Prisma.JsonValue;
    webhookUrl: string;
    webhookSecret: string | null;
    eventTimestamp: Date;
  }): Promise<FetchResult> {
    const bodyPayload = {
      event: entry.event,
      payload: entry.payload,
      timestamp: entry.eventTimestamp.getTime(),
    };
    const body = JSON.stringify(bodyPayload);
    const signature = entry.webhookSecret
      ? this.generateSignature(body, entry.webhookSecret)
      : '';
    const startTime = Date.now();

    try {
      const response = await fetch(entry.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': entry.event,
          'X-Webhook-Timestamp': bodyPayload.timestamp.toString(),
          'X-Webhook-Delivery-Id': entry.id,
          'Idempotency-Key': entry.id,
        },
        body,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          duration,
        };
      }

      const statusCode = response.status;

      return {
        success: false,
        permanent: !isRetryableStatusCode(statusCode),
        statusCode,
        error: `HTTP ${statusCode}`,
        duration,
      };
    } catch (error) {
      return {
        success: false,
        permanent: false,
        error: error instanceof Error ? error.message : 'Unknown webhook error',
        duration: Date.now() - startTime,
      };
    }
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }
}

export const tenantWebhookOutboxService = new TenantWebhookOutboxService();

export const startTenantWebhookOutboxWorker = () => {
  const pollIntervalMs = readPositiveInt(
    process.env.TENANT_WEBHOOK_OUTBOX_POLL_INTERVAL_MS,
    DEFAULT_POLL_INTERVAL_MS
  );

  let isRunning = false;

  const run = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      await tenantWebhookOutboxService.processDueEntries();
    } catch (error) {
      console.error(
        '[TenantWebhookOutbox] Worker failed to process due entries:',
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
