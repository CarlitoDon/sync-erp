import { describe, expect, it } from 'vitest';
import {
  BILLING_PLANS,
  DEFAULT_BILLING_PLAN_KEY,
  formatBillingLimit,
<<<<<<< HEAD
  formatPlanPrice,
=======
>>>>>>> origin/dev
  getBillingPlan,
  getLimitUsagePercent,
  isLimitExceeded,
} from '../../src/constants/billing';

describe('billing plan constants', () => {
<<<<<<< HEAD
  it('keeps free as the default plan', () => {
    const free = getBillingPlan(DEFAULT_BILLING_PLAN_KEY);

    expect(free.key).toBe('free');
    expect(free.monthlyPriceIdr).toBe(0);
    expect(free.limits.companies).toBe(1);
    expect(free.limits.mediaAccess).toBe(false);
    expect(free.limits.adsEnabled).toBe(true);
=======
  it('keeps starter as the default paid plan', () => {
    const starter = getBillingPlan(DEFAULT_BILLING_PLAN_KEY);

    expect(starter.key).toBe('starter');
    expect(starter.monthlyPriceIdr).toBeGreaterThan(0);
>>>>>>> origin/dev
  });

  it('defines a clear upgrade path through enterprise', () => {
    expect(BILLING_PLANS.map((plan) => plan.key)).toEqual([
<<<<<<< HEAD
      'free',
=======
>>>>>>> origin/dev
      'starter',
      'growth',
      'scale',
      'enterprise',
    ]);
<<<<<<< HEAD

    expect(getBillingPlan('starter').limits.adsEnabled).toBe(false);
    expect(getBillingPlan('starter').limits.mediaAccess).toBe(true);
=======
>>>>>>> origin/dev
  });

  it('formats and evaluates finite and unlimited limits', () => {
    expect(formatBillingLimit('unlimited')).toBe('Unlimited');
    expect(isLimitExceeded(3, 4)).toBe(true);
    expect(isLimitExceeded('unlimited', 999_999)).toBe(false);
    expect(getLimitUsagePercent(10, 4)).toBe(40);
    expect(getLimitUsagePercent('unlimited', 4)).toBe(0);
  });
<<<<<<< HEAD

  it('formats the free plan price clearly', () => {
    expect(formatPlanPrice(getBillingPlan('free'))).toBe('Gratis');
  });
=======
>>>>>>> origin/dev
});
