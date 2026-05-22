import { TRPCError } from '@trpc/server';
import { BillingSubscriptionStatus, prisma } from '@sync-erp/database';
import {
  BILLING_PLANS,
  BILLING_USAGE_METRICS,
  DEFAULT_BILLING_PLAN_KEY,
  type BillingFeatureKey,
  type BillingPlan,
  type BillingPlanKey,
  type BillingUsageMetricKey,
  formatBillingLimit,
  getBillingPlan,
} from '@sync-erp/shared';
import { resolveBillingPlanKey } from './company-subscription.service';

interface BillingLimitCheckInput {
  metric: BillingUsageMetricKey;
  companyId?: string;
  userId?: string;
}

interface BillingFeatureCheckInput {
  feature: BillingFeatureKey;
  companyId: string;
}

const ACTIVE_BILLING_STATUSES = [
  BillingSubscriptionStatus.TRIALING,
  BillingSubscriptionStatus.ACTIVE,
  BillingSubscriptionStatus.PAST_DUE,
];

const BILLING_FEATURE_LABELS: Record<BillingFeatureKey, string> = {
  rental: 'Rental operations',
  whatsapp: 'WhatsApp integration',
  apiAccess: 'API access',
  mediaAccess: 'Media access',
  adsEnabled: 'Ad-supported free plan',
  prioritySupport: 'Priority support',
};

function billingLimitsDisabled(): boolean {
  return process.env.SYNC_ERP_DISABLE_BILLING_LIMITS === 'true';
}

function getPlanRank(planKey: BillingPlanKey): number {
  return BILLING_PLANS.findIndex((plan) => plan.key === planKey);
}

function getHighestPlanKey(planKeys: BillingPlanKey[]): BillingPlanKey {
  return planKeys.reduce<BillingPlanKey>((highest, planKey) => {
    return getPlanRank(planKey) > getPlanRank(highest)
      ? planKey
      : highest;
  }, DEFAULT_BILLING_PLAN_KEY);
}

async function resolvePlanKeyForCompany(
  companyId: string
): Promise<BillingPlanKey> {
  const subscription = await prisma.companySubscription.findUnique({
    where: { companyId },
    select: { planKey: true },
  });

  return resolveBillingPlanKey(subscription?.planKey);
}

async function resolveHighestPlanKeyForUser(
  userId: string
): Promise<BillingPlanKey> {
  const subscriptions = await prisma.companySubscription.findMany({
    where: {
      status: { in: ACTIVE_BILLING_STATUSES },
      company: {
        members: {
          some: { userId },
        },
      },
    },
    select: { planKey: true },
  });

  const planKeys = subscriptions.map((subscription) =>
    resolveBillingPlanKey(subscription.planKey)
  );

  return planKeys.length > 0
    ? getHighestPlanKey(planKeys)
    : DEFAULT_BILLING_PLAN_KEY;
}

async function resolvePlanKeyForBillingCheck(
  input: BillingLimitCheckInput
): Promise<BillingPlanKey> {
  if (input.companyId) {
    return resolvePlanKeyForCompany(input.companyId);
  }

  if (input.metric === 'companies' && input.userId) {
    return resolveHighestPlanKeyForUser(input.userId);
  }

  return DEFAULT_BILLING_PLAN_KEY;
}

async function getCurrentUsage({
  metric,
  companyId,
  userId,
}: BillingLimitCheckInput): Promise<number> {
  switch (metric) {
    case 'companies':
      if (!userId) return 0;
      return prisma.companyMember.count({ where: { userId } });
    case 'users':
      if (!companyId) return 0;
      return prisma.companyMember.count({ where: { companyId } });
    case 'products':
      if (!companyId) return 0;
      return prisma.product.count({ where: { companyId } });
    case 'apiKeys':
      if (!companyId) return 0;
      return prisma.apiKey.count({
        where: { companyId, isActive: true },
      });
    case 'monthlyDocuments':
      return 0;
    default:
      return 0;
  }
}

export async function assertBillingLimitAvailable(
  input: BillingLimitCheckInput
): Promise<void> {
  if (billingLimitsDisabled()) {
    return;
  }

  const planKey = await resolvePlanKeyForBillingCheck(input);
  const plan = getBillingPlan(planKey);
  const limit = plan.limits[input.metric];

  if (limit === 'unlimited') {
    return;
  }

  const used = await getCurrentUsage(input);

  if (used < limit) {
    return;
  }

  const metric = BILLING_USAGE_METRICS[input.metric];

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: `${metric.label} limit reached for ${plan.name}: ${formatBillingLimit(limit)}. Upgrade your plan to continue.`,
  });
}

export async function getBillingPlanForCompany(
  companyId: string
): Promise<BillingPlan> {
  if (billingLimitsDisabled()) {
    return getBillingPlan('enterprise');
  }

  return getBillingPlan(await resolvePlanKeyForCompany(companyId));
}

export async function isBillingFeatureEnabled(
  input: BillingFeatureCheckInput
): Promise<boolean> {
  if (billingLimitsDisabled()) {
    return true;
  }

  const plan = await getBillingPlanForCompany(input.companyId);
  return plan.limits[input.feature];
}

export async function assertBillingFeatureAvailable(
  input: BillingFeatureCheckInput
): Promise<void> {
  const isEnabled = await isBillingFeatureEnabled(input);

  if (isEnabled) {
    return;
  }

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: `${BILLING_FEATURE_LABELS[input.feature]} is not available on your current plan. Upgrade your plan to continue.`,
  });
}
