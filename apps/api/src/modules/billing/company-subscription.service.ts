import {
  BillingCycle,
  BillingCheckoutSessionStatus,
  BillingProvider,
  BillingSubscriptionStatus,
  prisma,
  type Company,
  type BillingCheckoutSession,
  type CompanySubscription,
} from '@sync-erp/database';
import {
  BILLING_TRIAL_DAYS,
  DEFAULT_BILLING_PLAN_KEY,
  getBillingPlan,
  isBillingPlanKey,
  type BillingPlanKey,
} from '@sync-erp/shared';
import crypto from 'crypto';

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(date: Date, minutes: number): Date {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

export function resolveBillingPlanKey(
  value: string | null | undefined
): BillingPlanKey {
  return isBillingPlanKey(value)
    ? value
    : DEFAULT_BILLING_PLAN_KEY;
}

export async function ensureCompanySubscription(
  company: Pick<Company, 'id' | 'createdAt'>
): Promise<CompanySubscription> {
  const trialStartsAt = company.createdAt;
  const trialEndsAt = addDays(company.createdAt, BILLING_TRIAL_DAYS);

  return prisma.companySubscription.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      planKey: DEFAULT_BILLING_PLAN_KEY,
      status: BillingSubscriptionStatus.TRIALING,
      provider: BillingProvider.MANUAL,
      trialStartsAt,
      trialEndsAt,
      currentPeriodStartsAt: trialStartsAt,
      currentPeriodEndsAt: trialEndsAt,
    },
    update: {},
  });
}

export function isBillingProviderConfigured(): boolean {
  const provider = getBillingProvider();

  if (provider === BillingProvider.MIDTRANS) {
    return Boolean(getMidtransServerKey());
  }

  return true;
}

export function getBillingProviderName(): string | null {
  return getBillingProvider();
}

export function getBillingProvider(): BillingProvider {
  const configured = process.env.BILLING_PROVIDER?.toUpperCase();

  switch (configured) {
    case BillingProvider.STRIPE:
      return BillingProvider.STRIPE;
    case BillingProvider.XENDIT:
      return BillingProvider.XENDIT;
    case BillingProvider.MIDTRANS:
      return BillingProvider.MIDTRANS;
    default:
      return BillingProvider.MANUAL;
  }
}

function getMidtransServerKey(): string | null {
  return process.env.MIDTRANS_SERVER_KEY ?? null;
}

function isMidtransProduction(): boolean {
  return process.env.MIDTRANS_IS_PRODUCTION === 'true';
}

function getMidtransAppBaseUrl(): string {
  return isMidtransProduction()
    ? 'https://app.midtrans.com'
    : 'https://app.sandbox.midtrans.com';
}

function getMidtransAuthHeader(): string {
  const serverKey = getMidtransServerKey();

  if (!serverKey) {
    throw new Error('MIDTRANS_SERVER_KEY is not configured.');
  }

  return `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;
}

function createMidtransOrderId(checkoutSessionId: string): string {
  return `billing-${checkoutSessionId}`;
}

function buildMidtransExpiryStartTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');

  const datePart = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-');
  const timePart = [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join(':');

  return `${datePart} ${timePart} +0700`;
}

export function getWebAppUrl(): string {
  return (
    process.env.SYNC_ERP_WEB_URL ||
    process.env.VITE_SYNC_ERP_WEB_URL ||
    process.env.APP_URL ||
    'http://localhost:5173'
  );
}

export function getApiBaseUrl(): string {
  return (
    process.env.SYNC_ERP_API_BASE_URL ||
    process.env.SYNC_ERP_API_URL?.replace(/\/api\/trpc$/, '') ||
    'http://localhost:3001'
  );
}

export function getBillingWebhookSecret(): string {
  return (
    process.env.BILLING_WEBHOOK_SECRET ||
    process.env.SYNC_ERP_BOT_SECRET ||
    'dev-billing-webhook-secret'
  );
}

export function signBillingWebhookPayload(payload: string): string {
  return crypto
    .createHmac('sha256', getBillingWebhookSecret())
    .update(payload)
    .digest('hex');
}

export function calculatePlanAmountIdr(
  planKey: BillingPlanKey,
  billingCycle: BillingCycle
): number | null {
  const plan = getBillingPlan(planKey);

  return billingCycle === BillingCycle.ANNUAL
    ? plan.annualPriceIdr
    : plan.monthlyPriceIdr;
}

export async function createBillingCheckoutSession(input: {
  companyId: string;
  planKey: BillingPlanKey;
  billingCycle: BillingCycle;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<BillingCheckoutSession> {
  const provider = getBillingProvider();
  const amountIdr = calculatePlanAmountIdr(
    input.planKey,
    input.billingCycle
  );
  const webAppUrl = getWebAppUrl();
  const apiBaseUrl = getApiBaseUrl();
  const expiresAt =
    provider === BillingProvider.MIDTRANS
      ? addMinutes(new Date(), 15)
      : addDays(new Date(), 1);

  if (!amountIdr) {
    throw new Error(
      'Selected plan does not have a direct self-serve checkout price.'
    );
  }

  const session = await prisma.billingCheckoutSession.create({
    data: {
      companyId: input.companyId,
      provider,
      planKey: input.planKey,
      billingCycle: input.billingCycle,
      providerSessionId: `bcs_${crypto.randomUUID()}`,
      successUrl:
        input.successUrl ??
        `${webAppUrl}/settings/billing?checkout=success`,
      cancelUrl:
        input.cancelUrl ??
        `${webAppUrl}/settings/billing?checkout=cancelled`,
      expiresAt,
      amountIdr,
      metadata: {
        source: 'app',
      },
    },
  });

  if (provider !== BillingProvider.MIDTRANS) {
    return prisma.billingCheckoutSession.update({
      where: { id: session.id },
      data: {
        providerCheckoutUrl: `${apiBaseUrl}/api/billing/checkout/${session.id}`,
      },
    });
  }

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: {
      name: true,
    },
  });

  if (!company) {
    throw new Error('Company not found for billing checkout.');
  }

  const orderId = createMidtransOrderId(session.id);
  const response = await fetch(
    `${getMidtransAppBaseUrl()}/snap/v1/transactions`,
    {
      method: 'POST',
      headers: {
        Authorization: getMidtransAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: orderId,
          gross_amount: amountIdr,
        },
        item_details: [
          {
            id: input.planKey,
            name: `Sync ERP ${input.planKey} plan`,
            price: amountIdr,
            quantity: 1,
          },
        ],
        enabled_payments: ['qris', 'gopay', 'bank_transfer'],
        customer_details: {
          first_name: company.name,
        },
        expiry: {
          unit: 'minutes',
          duration: 15,
          start_time: buildMidtransExpiryStartTime(new Date()),
        },
        callbacks: {
          finish:
            input.successUrl ??
            `${webAppUrl}/settings/billing?checkout=success`,
          error:
            input.cancelUrl ??
            `${webAppUrl}/settings/billing?checkout=failed`,
          pending:
            `${webAppUrl}/settings/billing?checkout=pending`,
        },
        metadata: {
          checkoutSessionId: session.id,
          companyId: input.companyId,
          billingCycle: input.billingCycle,
          planKey: input.planKey,
        },
      }),
    }
  );

  if (!response.ok) {
    const responseText = await response.text();

    await prisma.billingCheckoutSession.update({
      where: { id: session.id },
      data: {
        status: BillingCheckoutSessionStatus.FAILED,
        failedAt: new Date(),
        metadata: {
          source: 'app',
          providerError: responseText,
        },
      },
    });

    throw new Error(
      `Midtrans checkout creation failed with status ${response.status}.`
    );
  }

  const data = (await response.json()) as {
    token?: string;
    redirect_url?: string;
  };

  return prisma.billingCheckoutSession.update({
    where: { id: session.id },
    data: {
      providerSessionId: orderId,
      providerCheckoutUrl: data.redirect_url,
      metadata: {
        source: 'app',
        midtransSnapToken: data.token ?? null,
      },
    },
  });
}

export async function markCheckoutSessionStatus(input: {
  checkoutSessionId: string;
  status: BillingCheckoutSessionStatus;
}): Promise<BillingCheckoutSession> {
  const now = new Date();

  return prisma.billingCheckoutSession.update({
    where: { id: input.checkoutSessionId },
    data: {
      status: input.status,
      completedAt:
        input.status === BillingCheckoutSessionStatus.COMPLETED
          ? now
          : undefined,
      canceledAt:
        input.status === BillingCheckoutSessionStatus.CANCELED
          ? now
          : undefined,
      failedAt:
        input.status === BillingCheckoutSessionStatus.FAILED
          ? now
          : undefined,
    },
  });
}
