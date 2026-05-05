import crypto from 'crypto';
import {
  BillingCheckoutSessionStatus,
  BillingCycle,
  BillingProvider,
  BillingSubscriptionStatus,
  BillingWebhookEventStatus,
  Prisma,
  prisma,
} from '@sync-erp/database';
import {
  DEFAULT_BILLING_PLAN_KEY,
  isBillingPlanKey,
} from '@sync-erp/shared';
import {
  getBillingWebhookSecret,
  markCheckoutSessionStatus,
} from './company-subscription.service';

export interface BillingWebhookPayload {
  eventId: string;
  eventType:
    | 'checkout.completed'
    | 'checkout.failed'
    | 'subscription.updated'
    | 'subscription.canceled';
  checkoutSessionId?: string;
  companyId?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  planKey?: string;
  billingCycle?: BillingCycle;
  currentPeriodStartsAt?: string;
  currentPeriodEndsAt?: string;
  graceEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MidtransWebhookNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  transaction_id?: string;
  payment_type?: string;
  fraud_status?: string;
  merchant_id?: string;
  settlement_time?: string;
  transaction_time?: string;
  currency?: string;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseDate(
  value: string | null | undefined
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return new Date(value);
}

function calculatePeriodEndFromCheckoutSession(input: {
  currentPeriodStartsAt: Date;
  billingCycle: BillingCycle;
}): Date {
  const next = new Date(input.currentPeriodStartsAt);

  if (input.billingCycle === BillingCycle.ANNUAL) {
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }

  next.setMonth(next.getMonth() + 1);
  return next;
}

export function verifyBillingWebhookSignature(
  rawPayload: string,
  signature: string | undefined
): boolean {
  if (!signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', getBillingWebhookSecret())
    .update(rawPayload)
    .digest('hex');

  if (signature.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export function verifyMidtransWebhookSignature(
  notification: MidtransWebhookNotification
): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;

  if (!serverKey) {
    return false;
  }

  const expected = crypto
    .createHash('sha512')
    .update(
      `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`
    )
    .digest('hex');

  return expected === notification.signature_key;
}

export function mapMidtransNotificationToBillingWebhookPayload(
  notification: MidtransWebhookNotification
): BillingWebhookPayload | null {
  const transactionStatus = notification.transaction_status;
  const fraudStatus = notification.fraud_status;
  const eventId = `${notification.transaction_id ?? notification.order_id}:${transactionStatus}`;

  if (
    transactionStatus === 'settlement' ||
    (transactionStatus === 'capture' &&
      fraudStatus !== 'challenge')
  ) {
    return {
      eventId,
      eventType: 'checkout.completed',
      providerSubscriptionId:
        notification.transaction_id ?? notification.order_id,
      currentPeriodStartsAt: new Date().toISOString(),
      metadata: {
        source: 'midtrans',
        paymentType: notification.payment_type ?? null,
        rawTransactionStatus: transactionStatus,
        fraudStatus: fraudStatus ?? null,
        orderId: notification.order_id,
      },
    };
  }

  if (
    transactionStatus === 'deny' ||
    transactionStatus === 'cancel' ||
    transactionStatus === 'expire' ||
    transactionStatus === 'failure'
  ) {
    return {
      eventId,
      eventType: 'checkout.failed',
      metadata: {
        source: 'midtrans',
        paymentType: notification.payment_type ?? null,
        rawTransactionStatus: transactionStatus,
        orderId: notification.order_id,
      },
    };
  }

  return null;
}

export async function processBillingWebhookEvent(input: {
  provider: BillingProvider;
  payload: BillingWebhookPayload;
}) {
  const existing = await prisma.billingWebhookEvent.findUnique({
    where: {
      provider_eventId: {
        provider: input.provider,
        eventId: input.payload.eventId,
      },
    },
  });

  if (existing?.status === BillingWebhookEventStatus.PROCESSED) {
    return {
      duplicate: true,
      webhookEvent: existing,
    };
  }

  const event = existing
    ? await prisma.billingWebhookEvent.update({
        where: { id: existing.id },
        data: {
          payload: toJsonValue(input.payload),
          status: BillingWebhookEventStatus.RECEIVED,
          errorMessage: null,
        },
      })
    : await prisma.billingWebhookEvent.create({
        data: {
          provider: input.provider,
          eventId: input.payload.eventId,
          eventType: input.payload.eventType,
          companyId: input.payload.companyId,
          providerCustomerId:
            input.payload.providerCustomerId,
          providerSubscriptionId:
            input.payload.providerSubscriptionId,
          payload: toJsonValue(input.payload),
        },
      });

  try {
    switch (input.payload.eventType) {
      case 'checkout.completed': {
        const now = new Date();
        const checkoutSession =
          input.payload.checkoutSessionId
            ? await prisma.billingCheckoutSession.findUnique({
                where: { id: input.payload.checkoutSessionId },
              })
            : input.payload.providerSubscriptionId
              ? await prisma.billingCheckoutSession.findFirst({
                  where: {
                    OR: [
                      {
                        providerSessionId:
                          input.payload.providerSubscriptionId,
                      },
                      {
                        providerSessionId:
                          input.payload.metadata?.orderId as
                            | string
                            | undefined,
                      },
                    ],
                  },
                })
              : input.payload.metadata?.orderId
                ? await prisma.billingCheckoutSession.findFirst({
                    where: {
                      providerSessionId:
                        input.payload.metadata.orderId as string,
                    },
                  })
                : null;

        if (!checkoutSession) {
          throw new Error('Checkout session not found.');
        }

        const planKey = isBillingPlanKey(input.payload.planKey)
          ? input.payload.planKey
          : isBillingPlanKey(checkoutSession.planKey)
            ? checkoutSession.planKey
            : DEFAULT_BILLING_PLAN_KEY;

        await markCheckoutSessionStatus({
          checkoutSessionId: checkoutSession.id,
          status: BillingCheckoutSessionStatus.COMPLETED,
        });

        await prisma.companySubscription.upsert({
          where: { companyId: checkoutSession.companyId },
          create: {
            companyId: checkoutSession.companyId,
            planKey,
            status: BillingSubscriptionStatus.ACTIVE,
            provider: input.provider,
            providerCustomerId:
              input.payload.providerCustomerId ??
              `manual_customer_${checkoutSession.companyId}`,
            providerSubscriptionId:
              input.payload.providerSubscriptionId ??
              checkoutSession.providerSessionId,
            currentPeriodStartsAt:
              parseDate(
                input.payload.currentPeriodStartsAt
              ) ?? now,
            currentPeriodEndsAt:
              parseDate(input.payload.currentPeriodEndsAt) ??
              calculatePeriodEndFromCheckoutSession({
                currentPeriodStartsAt:
                  parseDate(
                    input.payload.currentPeriodStartsAt
                  ) ?? now,
                billingCycle: checkoutSession.billingCycle,
              }),
            graceEndsAt: parseDate(input.payload.graceEndsAt),
            cancelAtPeriodEnd:
              input.payload.cancelAtPeriodEnd ?? false,
            metadata: input.payload.metadata
              ? toJsonValue(input.payload.metadata)
              : undefined,
          },
          update: {
            planKey,
            status: BillingSubscriptionStatus.ACTIVE,
            provider: input.provider,
            providerCustomerId:
              input.payload.providerCustomerId ??
              undefined,
            providerSubscriptionId:
              input.payload.providerSubscriptionId ??
              checkoutSession.providerSessionId ??
              undefined,
            currentPeriodStartsAt:
              parseDate(
                input.payload.currentPeriodStartsAt
              ) ?? now,
            currentPeriodEndsAt:
              parseDate(input.payload.currentPeriodEndsAt) ??
              calculatePeriodEndFromCheckoutSession({
                currentPeriodStartsAt:
                  parseDate(
                    input.payload.currentPeriodStartsAt
                  ) ?? now,
                billingCycle: checkoutSession.billingCycle,
              }),
            graceEndsAt: parseDate(input.payload.graceEndsAt),
            cancelAtPeriodEnd:
              input.payload.cancelAtPeriodEnd ?? false,
            canceledAt: parseDate(input.payload.canceledAt),
            metadata: input.payload.metadata
              ? toJsonValue(input.payload.metadata)
              : undefined,
          },
        });
        break;
      }

      case 'checkout.failed': {
        const checkoutSessionId =
          input.payload.checkoutSessionId ??
          (
            await prisma.billingCheckoutSession.findFirst({
              where: {
                OR: [
                  input.payload.providerSubscriptionId
                    ? {
                        providerSessionId:
                          input.payload.providerSubscriptionId,
                      }
                    : undefined,
                  input.payload.metadata?.orderId
                    ? {
                        providerSessionId:
                          input.payload.metadata.orderId as string,
                      }
                    : undefined,
                ].filter(Boolean) as Array<{
                  providerSessionId: string;
                }>,
              },
              select: { id: true },
            })
          )?.id;

        if (checkoutSessionId) {
          await markCheckoutSessionStatus({
            checkoutSessionId,
            status: BillingCheckoutSessionStatus.FAILED,
          });
        }
        break;
      }

      case 'subscription.updated': {
        if (!input.payload.companyId) {
          throw new Error('Missing companyId.');
        }

        await prisma.companySubscription.update({
          where: { companyId: input.payload.companyId },
          data: {
            status: BillingSubscriptionStatus.ACTIVE,
            provider: input.provider,
            providerCustomerId:
              input.payload.providerCustomerId ??
              undefined,
            providerSubscriptionId:
              input.payload.providerSubscriptionId ??
              undefined,
            currentPeriodStartsAt: parseDate(
              input.payload.currentPeriodStartsAt
            ),
            currentPeriodEndsAt: parseDate(
              input.payload.currentPeriodEndsAt
            ),
            graceEndsAt: parseDate(input.payload.graceEndsAt),
            cancelAtPeriodEnd:
              input.payload.cancelAtPeriodEnd ?? false,
            canceledAt: parseDate(input.payload.canceledAt),
            metadata: input.payload.metadata
              ? toJsonValue(input.payload.metadata)
              : undefined,
          },
        });
        break;
      }

      case 'subscription.canceled': {
        if (!input.payload.companyId) {
          throw new Error('Missing companyId.');
        }

        await prisma.companySubscription.update({
          where: { companyId: input.payload.companyId },
          data: {
            status: BillingSubscriptionStatus.CANCELED,
            cancelAtPeriodEnd:
              input.payload.cancelAtPeriodEnd ?? true,
            canceledAt:
              parseDate(input.payload.canceledAt) ?? new Date(),
            graceEndsAt: parseDate(input.payload.graceEndsAt),
          },
        });
        break;
      }
    }

    const processed = await prisma.billingWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: BillingWebhookEventStatus.PROCESSED,
        processedAt: new Date(),
      },
    });

    return {
      duplicate: false,
      webhookEvent: processed,
    };
  } catch (error) {
    await prisma.billingWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: BillingWebhookEventStatus.FAILED,
        errorMessage:
          error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
}
