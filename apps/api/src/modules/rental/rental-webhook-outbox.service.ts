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

type PaymentStatusAction = 'confirmed' | 'rejected' | 'claimed';

type DeliveryResult = {
  success: boolean;
  deliveryId: string;
  status: RentalWebhookOutboxStatus;
  attempts: number;
  statusCode?: number;
  error?: string;
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

type DeliveryRequest = {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

type InvalidDeliveryRequest = {
  error: string;
};

const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_RETRY_BASE_MS = 30_000;
const DEFAULT_RETRY_MAX_MS = 15 * 60_000;
const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_DEAD_LETTER_WARN_THRESHOLD = 20;

const asObject = (value: Prisma.JsonValue) => {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
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

const readNumber = (
  payload: Record<string, Prisma.JsonValue>,
  key: string
) => {
  const value = payload[key];
  return typeof value === 'number' ? value : undefined;
};

export class RentalWebhookOutboxService {
  async enqueueNewOrder(
    input: {
      companyId: string;
      token: string;
      orderNumber: string;
      customerName: string;
      customerPhone: string;
      totalAmount: number;
    },
    options: {
      autoRetry?: boolean;
    } = {}
  ): Promise<DeliveryResult> {
    return this.enqueueDelivery({
      companyId: input.companyId,
      deliveryType: RentalWebhookDeliveryType.NEW_ORDER,
      orderPublicToken: input.token,
      orderNumber: input.orderNumber,
      autoRetry: options.autoRetry ?? true,
      payload: {
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        totalAmount: input.totalAmount,
      },
    });
  }

  async enqueuePaymentStatus(input: {
    companyId: string;
    token: string;
    orderNumber?: string;
    action: PaymentStatusAction;
    paymentReference?: string;
    failReason?: string;
    paymentMethod?: string;
  }): Promise<DeliveryResult> {
    return this.enqueueDelivery({
      companyId: input.companyId,
      deliveryType: RentalWebhookDeliveryType.PAYMENT_STATUS,
      orderPublicToken: input.token,
      orderNumber: input.orderNumber,
      autoRetry: true,
      payload: {
        action: input.action,
        paymentReference: input.paymentReference,
        failReason: input.failReason,
        paymentMethod: input.paymentMethod,
      },
    });
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
      console.warn('[RentalWebhookOutbox] Retry cycle summary', {
        ...summary,
        queue: queueCounts,
      });

      const deadLetterThreshold = readPositiveInt(
        process.env.RENTAL_WEBHOOK_OUTBOX_DEAD_LETTER_WARN_THRESHOLD,
        DEFAULT_DEAD_LETTER_WARN_THRESHOLD
      );

      if (queueCounts.deadLetter >= deadLetterThreshold) {
        console.warn('[RentalWebhookOutbox] Dead-letter queue exceeds threshold', {
          deadLetterCount: queueCounts.deadLetter,
          threshold: deadLetterThreshold,
        });
      }
    }

    return summary;
  }

  async getQueueCounts(companyId?: string): Promise<OutboxQueueCounts> {
    const where = companyId ? { companyId } : {};

    const [pending, processing, failed, deadLetter] = await Promise.all([
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

    return {
      pending,
      processing,
      failed,
      deadLetter,
    };
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
        : {
            reason:
              'Dead-letter queue exceeded warning threshold',
          }),
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
    return prisma.rentalWebhookOutbox.findFirst({
      where: {
        id: input.id,
        companyId: input.companyId,
      },
    });
  }

  async requeueDelivery(
    id: string,
    options?: { companyId?: string }
  ): Promise<boolean> {
    const where: Prisma.RentalWebhookOutboxWhereInput = {
      id,
      ...(options?.companyId
        ? { companyId: options.companyId }
        : {}),
    };

    const entry = await prisma.rentalWebhookOutbox.findFirst({ where });

    if (!entry) {
      return false;
    }

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
    const filterStatuses =
      input.statuses && input.statuses.length > 0
        ? input.statuses
        : [
            RentalWebhookOutboxStatus.FAILED,
            RentalWebhookOutboxStatus.DEAD_LETTER,
          ];

    const candidates = await prisma.rentalWebhookOutbox.findMany({
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

    const result = await prisma.rentalWebhookOutbox.updateMany({
      where: {
        id: { in: candidates.map((item) => item.id) },
      },
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

  private async enqueueDelivery(input: {
    companyId: string;
    deliveryType: RentalWebhookDeliveryType;
    orderPublicToken: string;
    orderNumber?: string;
    autoRetry: boolean;
    payload: Prisma.InputJsonObject;
  }): Promise<DeliveryResult> {
    const delivery = await prisma.rentalWebhookOutbox.create({
      data: {
        companyId: input.companyId,
        deliveryType: input.deliveryType,
        orderPublicToken: input.orderPublicToken,
        orderNumber: input.orderNumber,
        autoRetry: input.autoRetry,
        payload: input.payload,
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

  private async processDelivery(
    id: string
  ): Promise<DeliveryResult | null> {
    const claimedEntry = await this.claimDelivery(id);

    if (!claimedEntry) {
      return null;
    }

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

    if (!candidate) {
      return null;
    }

    const now = new Date();
    const claimed = await prisma.rentalWebhookOutbox.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
      },
      data: {
        status: RentalWebhookOutboxStatus.PROCESSING,
        attempts: { increment: 1 },
        lastAttemptAt: now,
      },
    });

    if (claimed.count === 0) {
      return null;
    }

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

    return Math.min(retryBaseMs * 2 ** Math.max(attempts - 1, 0), retryMaxMs);
  }

  private async performFetch(entry: {
    id: string;
    deliveryType: RentalWebhookDeliveryType;
    orderPublicToken: string;
    orderNumber: string | null;
    payload: Prisma.JsonValue;
  }): Promise<FetchResult> {
    const baseUrl = (
      process.env.SANTI_LIVING_WEBHOOK_URL || 'http://localhost:3002'
    ).replace(/\/$/, '');
    const apiKey = process.env.SANTI_LIVING_WEBHOOK_API_KEY || '';

    if (!apiKey) {
      return {
        success: false,
        permanent: false,
        error: 'SANTI_LIVING_WEBHOOK_API_KEY not configured',
      };
    }

    const payload = asObject(entry.payload);
    const request =
      entry.deliveryType === RentalWebhookDeliveryType.NEW_ORDER
        ? this.buildNewOrderRequest(
            baseUrl,
            apiKey,
            entry.id,
            entry.orderPublicToken,
            entry.orderNumber,
            payload
          )
        : this.buildPaymentStatusRequest(
            baseUrl,
            apiKey,
            entry.id,
            entry.orderPublicToken,
            payload
          );

    if ('error' in request) {
      return {
        success: false,
        permanent: true,
        error: request.error,
      };
    }

    try {
      const response = await fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
        };
      }

      const errorData = (await response
        .json()
        .catch(() => ({}))) as { message?: string; error?: string };
      const errorMessage =
        errorData.message ||
        errorData.error ||
        `Webhook failed: ${response.status}`;

      return {
        success: false,
        permanent: !isRetryableStatusCode(response.status),
        statusCode: response.status,
        error: errorMessage,
      };
    } catch (error) {
      return {
        success: false,
        permanent: false,
        error:
          error instanceof Error ? error.message : 'Unknown webhook error',
      };
    }
  }

  private buildNewOrderRequest(
    baseUrl: string,
    apiKey: string,
    deliveryId: string,
    token: string,
    orderNumber: string | null,
    payload: Record<string, Prisma.JsonValue>
  ): DeliveryRequest | InvalidDeliveryRequest {
    const customerName = readString(payload, 'customerName');
    const customerPhone = readString(payload, 'customerPhone');
    const totalAmount = readNumber(payload, 'totalAmount');

    if (
      !customerName ||
      !customerPhone ||
      totalAmount === undefined ||
      !orderNumber
    ) {
      return {
        error: 'Rental webhook outbox payload is invalid for new order',
      };
    }

    return {
      url: `${baseUrl}/api/orders/${token}/notify-admin`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Webhook-Delivery-Id': deliveryId,
        'Idempotency-Key': deliveryId,
      },
      body: {
        action: 'new_order',
        orderNumber,
        customerName,
        customerPhone,
        totalAmount,
      },
    };
  }

  private buildPaymentStatusRequest(
    baseUrl: string,
    apiKey: string,
    deliveryId: string,
    token: string,
    payload: Record<string, Prisma.JsonValue>
  ): DeliveryRequest | InvalidDeliveryRequest {
    const action = readString(payload, 'action');

    if (!action) {
      return {
        error:
          'Rental webhook outbox payload is invalid for payment status',
      };
    }

    return {
      url: `${baseUrl}/api/orders/${token}/notify-payment`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Webhook-Delivery-Id': deliveryId,
        'Idempotency-Key': deliveryId,
      },
      body: {
        action,
        paymentReference: readString(payload, 'paymentReference'),
        failReason: readString(payload, 'failReason'),
        paymentMethod: readString(payload, 'paymentMethod'),
      },
    };
  }
}

export const rentalWebhookOutboxService =
  new RentalWebhookOutboxService();

export const startRentalWebhookOutboxWorker = () => {
  const pollIntervalMs = readPositiveInt(
    process.env.RENTAL_WEBHOOK_OUTBOX_POLL_INTERVAL_MS,
    DEFAULT_POLL_INTERVAL_MS
  );
  let isRunning = false;

  const run = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      await rentalWebhookOutboxService.processDueEntries();
    } catch (error) {
      console.error(
        '[RentalWebhookOutbox] Worker failed to process due entries:',
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
