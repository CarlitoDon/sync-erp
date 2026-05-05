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
      expiresAt: addDays(new Date(), 1),
      amountIdr: amountIdr ?? undefined,
      metadata: {
        source: 'app',
      },
    },
  });

  return prisma.billingCheckoutSession.update({
    where: { id: session.id },
    data: {
      providerCheckoutUrl: `${apiBaseUrl}/api/billing/checkout/${session.id}`,
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
