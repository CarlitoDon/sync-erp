import { TRPCError } from '@trpc/server';
import { prisma } from '@sync-erp/database';
import {
  BILLING_USAGE_METRICS,
  DEFAULT_BILLING_PLAN_KEY,
  type BillingUsageMetricKey,
  formatBillingLimit,
  getBillingPlan,
} from '@sync-erp/shared';

interface BillingLimitCheckInput {
  metric: BillingUsageMetricKey;
  companyId?: string;
  userId?: string;
}

function billingLimitsDisabled(): boolean {
  return process.env.SYNC_ERP_DISABLE_BILLING_LIMITS === 'true';
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

  const plan = getBillingPlan(DEFAULT_BILLING_PLAN_KEY);
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
