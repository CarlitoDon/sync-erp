import { describe, expect, it } from 'vitest';
import {
  BILLING_PLANS,
  DEFAULT_BILLING_PLAN_KEY,
  formatBillingLimit,
  getBillingPlan,
  getLimitUsagePercent,
  isLimitExceeded,
} from '../../src/constants/billing';

describe('billing plan constants', () => {
  it('keeps starter as the default paid plan', () => {
    const starter = getBillingPlan(DEFAULT_BILLING_PLAN_KEY);

    expect(starter.key).toBe('starter');
    expect(starter.monthlyPriceIdr).toBeGreaterThan(0);
  });

  it('defines a clear upgrade path through enterprise', () => {
    expect(BILLING_PLANS.map((plan) => plan.key)).toEqual([
      'starter',
      'growth',
      'scale',
      'enterprise',
    ]);
  });

  it('formats and evaluates finite and unlimited limits', () => {
    expect(formatBillingLimit('unlimited')).toBe('Unlimited');
    expect(isLimitExceeded(3, 4)).toBe(true);
    expect(isLimitExceeded('unlimited', 999_999)).toBe(false);
    expect(getLimitUsagePercent(10, 4)).toBe(40);
    expect(getLimitUsagePercent('unlimited', 4)).toBe(0);
  });
});
