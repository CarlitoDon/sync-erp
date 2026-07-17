import { trpc } from '@/lib/trpc';

export function useBillingFeatures() {
  const { data, isLoading } = trpc.billing.getOverview.useQuery();
  const limits = data?.currentPlan?.limits;

  return {
    isLoading,
    currentPlan: data?.currentPlan ?? null,
    currentPlanKey: data?.currentPlanKey ?? null,
    mediaAccess: limits?.mediaAccess ?? false,
    adsEnabled: limits?.adsEnabled ?? false,
  };
}
