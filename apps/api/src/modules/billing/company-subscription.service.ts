import {
  BillingProvider,
  BillingSubscriptionStatus,
  prisma,
  type Company,
  type CompanySubscription,
} from '@sync-erp/database';
import {
  BILLING_TRIAL_DAYS,
  DEFAULT_BILLING_PLAN_KEY,
  isBillingPlanKey,
  type BillingPlanKey,
} from '@sync-erp/shared';

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
  return Boolean(process.env.BILLING_PROVIDER);
}

export function getBillingProviderName(): string | null {
  return process.env.BILLING_PROVIDER ?? null;
}
