import { beforeEach, describe, expect, it } from 'vitest';
import { BillingSubscriptionStatus } from '@sync-erp/database';
import { mockPrisma } from '../setup';
import { ensureCompanySubscription } from '../../src/modules/billing/company-subscription.service';

describe('company subscription service', () => {
  beforeEach(() => {
    mockPrisma.companySubscription.upsert.mockResolvedValue({
      id: 'subscription-1',
    });
  });

  it('creates new company subscriptions on the free plan by default', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');

    await ensureCompanySubscription({
      id: 'company-1',
      createdAt,
    });

    expect(mockPrisma.companySubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          companyId: 'company-1',
          planKey: 'free',
          status: BillingSubscriptionStatus.ACTIVE,
          trialStartsAt: null,
          trialEndsAt: null,
          currentPeriodEndsAt: null,
        }),
      })
    );
  });
});
