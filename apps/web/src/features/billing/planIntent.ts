import {
  DEFAULT_BILLING_PLAN_KEY,
  type BillingPlanKey,
  isBillingPlanKey,
} from '@sync-erp/shared';

const BILLING_PLAN_INTENT_STORAGE_KEY = 'syncErpBillingPlanIntent';

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function getBillingPlanIntent(): BillingPlanKey | null {
  if (!canUseStorage()) {
    return null;
  }

  const value = window.localStorage.getItem(
    BILLING_PLAN_INTENT_STORAGE_KEY
  );

  return isBillingPlanKey(value) ? value : null;
}

export function setBillingPlanIntent(planKey: BillingPlanKey) {
  if (!canUseStorage()) {
    return;
  }

  if (planKey === DEFAULT_BILLING_PLAN_KEY) {
    window.localStorage.removeItem(BILLING_PLAN_INTENT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    BILLING_PLAN_INTENT_STORAGE_KEY,
    planKey
  );
}

export function clearBillingPlanIntent() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(BILLING_PLAN_INTENT_STORAGE_KEY);
}

export function getPostCompanyRedirect(defaultPath = '/dashboard') {
  const planKey = getBillingPlanIntent();

  if (!planKey || planKey === DEFAULT_BILLING_PLAN_KEY) {
    return defaultPath;
  }

  return `/settings/billing?intentPlan=${planKey}`;
}
