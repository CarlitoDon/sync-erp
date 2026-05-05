import { Router } from 'express';
import {
  BillingCheckoutSessionStatus,
  BillingProvider,
  BillingCycle,
  BillingWebhookEventStatus,
  Prisma,
} from '@sync-erp/database';
import { prisma } from '@sync-erp/database';
import {
  formatAnnualPlanPrice,
  formatPlanPrice,
  getBillingPlan,
  isBillingPlanKey,
} from '@sync-erp/shared';
import {
  getWebAppUrl,
  signBillingWebhookPayload,
} from './company-subscription.service';
import {
  mapMidtransNotificationToBillingWebhookPayload,
  processBillingWebhookEvent,
  verifyMidtransWebhookSignature,
  verifyBillingWebhookSignature,
  type MidtransWebhookNotification,
  type BillingWebhookPayload,
} from './billing-webhook.service';

export const billingHttpRouter = Router();

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function formatCheckoutAmount(
  planKey: string,
  billingCycle: BillingCycle
): string {
  if (!isBillingPlanKey(planKey)) {
    return '-';
  }

  const plan = getBillingPlan(planKey);

  return billingCycle === BillingCycle.ANNUAL
    ? formatAnnualPlanPrice(plan)
    : formatPlanPrice(plan);
}

function renderCheckoutPage(input: {
  companyName: string;
  planName: string;
  billingCycle: string;
  amountLabel: string;
  checkoutSessionId: string;
  provider: string;
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Sync ERP Billing Checkout</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f5f7fb; margin: 0; padding: 32px; color: #1f2937; }
      .card { max-width: 680px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
      h1 { margin-top: 0; font-size: 28px; }
      .meta { background: #f8fafc; border-radius: 12px; padding: 16px; margin: 20px 0; }
      .row { display: flex; justify-content: space-between; margin: 8px 0; gap: 16px; }
      .label { color: #64748b; }
      .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
      button { border: 0; border-radius: 10px; padding: 12px 18px; font-size: 15px; cursor: pointer; }
      .primary { background: #111827; color: white; }
      .danger { background: #fee2e2; color: #991b1b; }
      .muted { background: #e5e7eb; color: #111827; }
      .note { margin-top: 20px; color: #64748b; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Sync ERP Billing Checkout</h1>
      <p>Manual checkout sandbox untuk menguji alur subscribe, webhook, dan billing runtime.</p>
      <div class="meta">
        <div class="row"><span class="label">Company</span><strong>${input.companyName}</strong></div>
        <div class="row"><span class="label">Plan</span><strong>${input.planName}</strong></div>
        <div class="row"><span class="label">Billing cycle</span><strong>${input.billingCycle}</strong></div>
        <div class="row"><span class="label">Amount</span><strong>${input.amountLabel}</strong></div>
        <div class="row"><span class="label">Provider</span><strong>${input.provider}</strong></div>
      </div>
      <div class="actions">
        <form method="post" action="/api/billing/checkout/${input.checkoutSessionId}/confirm">
          <button class="primary" type="submit">Confirm Payment</button>
        </form>
        <form method="post" action="/api/billing/checkout/${input.checkoutSessionId}/fail">
          <button class="danger" type="submit">Simulate Failure</button>
        </form>
        <form method="post" action="/api/billing/checkout/${input.checkoutSessionId}/cancel">
          <button class="muted" type="submit">Cancel</button>
        </form>
      </div>
      <p class="note">Use halaman ini untuk testing lokal/staging sampai provider live dihubungkan.</p>
    </div>
  </body>
</html>`;
}

async function emitManualWebhook(
  payload: BillingWebhookPayload
) {
  const rawPayload = JSON.stringify(payload);
  const signature = signBillingWebhookPayload(rawPayload);

  if (!verifyBillingWebhookSignature(rawPayload, signature)) {
    throw new Error('Generated webhook signature failed verification.');
  }

  return processBillingWebhookEvent({
    provider: BillingProvider.MANUAL,
    payload,
  });
}

billingHttpRouter.get('/checkout/:checkoutSessionId', async (req, res) => {
  const checkoutSession =
    await prisma.billingCheckoutSession.findUnique({
      where: { id: req.params.checkoutSessionId },
      include: {
        company: {
          select: {
            name: true,
          },
        },
      },
    });

  if (!checkoutSession) {
    res.status(404).send('Checkout session not found.');
    return;
  }

  const plan = isBillingPlanKey(checkoutSession.planKey)
    ? getBillingPlan(checkoutSession.planKey)
    : null;

  res
    .status(200)
    .type('html')
    .send(
      renderCheckoutPage({
        companyName: checkoutSession.company.name,
        planName: plan?.name ?? checkoutSession.planKey,
        billingCycle: checkoutSession.billingCycle,
        amountLabel: formatCheckoutAmount(
          checkoutSession.planKey,
          checkoutSession.billingCycle
        ),
        checkoutSessionId: checkoutSession.id,
        provider: checkoutSession.provider,
      })
    );
});

billingHttpRouter.post(
  '/checkout/:checkoutSessionId/confirm',
  async (req, res, next) => {
    try {
      const checkoutSession =
        await prisma.billingCheckoutSession.findUnique({
          where: { id: req.params.checkoutSessionId },
        });

      if (!checkoutSession) {
        res.status(404).send('Checkout session not found.');
        return;
      }

      await emitManualWebhook({
        eventId: `manual_checkout_completed_${checkoutSession.id}`,
        eventType: 'checkout.completed',
        checkoutSessionId: checkoutSession.id,
        companyId: checkoutSession.companyId,
        providerCustomerId: `manual_customer_${checkoutSession.companyId}`,
        providerSubscriptionId:
          checkoutSession.providerSessionId ??
          `manual_subscription_${checkoutSession.id}`,
        planKey: checkoutSession.planKey,
        billingCycle: checkoutSession.billingCycle,
        currentPeriodStartsAt: new Date().toISOString(),
        currentPeriodEndsAt: checkoutSession.expiresAt.toISOString(),
        metadata: {
          source: 'manual-checkout',
        },
      });

      res.redirect(
        checkoutSession.successUrl ||
          `${getWebAppUrl()}/settings/billing?checkout=success`
      );
    } catch (error) {
      next(error);
    }
  }
);

billingHttpRouter.post(
  '/checkout/:checkoutSessionId/fail',
  async (req, res, next) => {
    try {
      const checkoutSession =
        await prisma.billingCheckoutSession.findUnique({
          where: { id: req.params.checkoutSessionId },
        });

      if (!checkoutSession) {
        res.status(404).send('Checkout session not found.');
        return;
      }

      await emitManualWebhook({
        eventId: `manual_checkout_failed_${checkoutSession.id}`,
        eventType: 'checkout.failed',
        checkoutSessionId: checkoutSession.id,
        companyId: checkoutSession.companyId,
        planKey: checkoutSession.planKey,
        billingCycle: checkoutSession.billingCycle,
        metadata: {
          source: 'manual-checkout',
        },
      });

      res.redirect(
        checkoutSession.cancelUrl ||
          `${getWebAppUrl()}/settings/billing?checkout=failed`
      );
    } catch (error) {
      next(error);
    }
  }
);

billingHttpRouter.post(
  '/checkout/:checkoutSessionId/cancel',
  async (req, res, next) => {
    try {
      const checkoutSession =
        await prisma.billingCheckoutSession.update({
          where: { id: req.params.checkoutSessionId },
          data: {
            status: BillingCheckoutSessionStatus.CANCELED,
            canceledAt: new Date(),
          },
        });

      res.redirect(
        checkoutSession.cancelUrl ||
          `${getWebAppUrl()}/settings/billing?checkout=cancelled`
      );
    } catch (error) {
      next(error);
    }
  }
);

billingHttpRouter.post('/webhooks/manual', async (req, res, next) => {
  try {
    const rawPayload = JSON.stringify(req.body ?? {});
    const signature = req.header('x-billing-signature');

    if (!verifyBillingWebhookSignature(rawPayload, signature)) {
      res.status(401).json({
        ok: false,
        error: 'Invalid billing webhook signature.',
      });
      return;
    }

    const result = await processBillingWebhookEvent({
      provider: BillingProvider.MANUAL,
      payload: req.body as BillingWebhookPayload,
    });

    res.status(200).json({
      ok: true,
      duplicate: result.duplicate,
    });
  } catch (error) {
    next(error);
  }
});

billingHttpRouter.post('/webhooks/midtrans', async (req, res, next) => {
  try {
    const notification = req.body as MidtransWebhookNotification;

    if (!verifyMidtransWebhookSignature(notification)) {
      res.status(403).json({
        ok: false,
        error: 'Invalid Midtrans signature.',
      });
      return;
    }

    const payload =
      mapMidtransNotificationToBillingWebhookPayload(
        notification
      );

    if (!payload) {
      await prisma.billingWebhookEvent.create({
        data: {
          provider: BillingProvider.MIDTRANS,
          eventId: `${notification.transaction_id ?? notification.order_id}:${notification.transaction_status}:ignored`,
          eventType: notification.transaction_status,
          status: BillingWebhookEventStatus.IGNORED,
          providerSubscriptionId:
            notification.transaction_id ?? notification.order_id,
          payload: toJsonValue(notification),
        },
      });

      res.status(200).json({
        ok: true,
        ignored: true,
      });
      return;
    }

    payload.metadata = {
      ...(payload.metadata ?? {}),
      orderId: notification.order_id,
      statusCode: notification.status_code,
      grossAmount: notification.gross_amount,
      transactionId: notification.transaction_id ?? null,
    };

    const result = await processBillingWebhookEvent({
      provider: BillingProvider.MIDTRANS,
      payload,
    });

    res.status(200).json({
      ok: true,
      duplicate: result.duplicate,
    });
  } catch (error) {
    next(error);
  }
});
