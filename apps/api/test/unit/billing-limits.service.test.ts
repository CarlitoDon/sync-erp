import { beforeEach, describe, expect, it } from 'vitest';
import { mockPrisma } from '../setup';
import {
  assertBillingFeatureAvailable,
  assertBillingLimitAvailable,
  isBillingFeatureEnabled,
} from '../../src/modules/billing/billing-limits.service';

describe('billing limits service', () => {
  beforeEach(() => {
    delete process.env.SYNC_ERP_DISABLE_BILLING_LIMITS;
  });

  it('blocks second company creation on the default free plan', async () => {
    mockPrisma.companySubscription.findMany.mockResolvedValue([]);
    mockPrisma.companyMember.count.mockResolvedValue(1);

    await expect(
      assertBillingLimitAvailable({
        metric: 'companies',
        userId: 'user-1',
      })
    ).rejects.toThrow('Companies limit reached for Free');
  });

  it('uses the highest active user plan for company creation limits', async () => {
    mockPrisma.companySubscription.findMany.mockResolvedValue([
      { planKey: 'free' },
      { planKey: 'growth' },
    ]);
    mockPrisma.companyMember.count.mockResolvedValue(2);

    await expect(
      assertBillingLimitAvailable({
        metric: 'companies',
        userId: 'user-1',
      })
    ).resolves.toBeUndefined();
  });

  it('exposes media access from the company plan', async () => {
    mockPrisma.companySubscription.findUnique.mockResolvedValue({
      planKey: 'free',
    });

    await expect(
      isBillingFeatureEnabled({
        companyId: 'company-1',
        feature: 'mediaAccess',
      })
    ).resolves.toBe(false);

    await expect(
      assertBillingFeatureAvailable({
        companyId: 'company-1',
        feature: 'mediaAccess',
      })
    ).rejects.toThrow('Media access is not available');

    mockPrisma.companySubscription.findUnique.mockResolvedValue({
      planKey: 'starter',
    });

    await expect(
      isBillingFeatureEnabled({
        companyId: 'company-1',
        feature: 'mediaAccess',
      })
    ).resolves.toBe(true);
  });
});
