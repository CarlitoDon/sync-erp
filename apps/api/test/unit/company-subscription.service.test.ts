import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BillingCycle,
  BillingProvider,
  BillingSubscriptionStatus,
} from '@sync-erp/database';
import { mockPrisma } from '../setup';
import {
  createBillingCheckoutSession,
  ensureCompanySubscription,
} from '../../src/modules/billing/company-subscription.service';

describe('company subscription service', () => {
  beforeEach(() => {
    mockPrisma.companySubscription.upsert.mockResolvedValue({
      id: 'subscription-1',
    });
  });

  afterEach(() => {
    delete process.env.SYNC_ERP_WEB_URL;
    delete process.env.SYNC_ERP_API_BASE_URL;
    delete process.env.BILLING_PROVIDER;
    delete process.env.MIDTRANS_SERVER_KEY;
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

  it('creates manual checkout URLs with checkout session ids', async () => {
    process.env.SYNC_ERP_WEB_URL = 'https://app.sync-erp.test';
    process.env.SYNC_ERP_API_BASE_URL = 'https://api.sync-erp.test';
    delete process.env.BILLING_PROVIDER;
    delete process.env.MIDTRANS_SERVER_KEY;

    const expiresAt = new Date('2026-01-02T00:00:00.000Z');
    mockPrisma.billingCheckoutSession.create.mockResolvedValue({
      id: 'checkout-1',
      companyId: 'company-1',
      provider: BillingProvider.MANUAL,
      planKey: 'growth',
      billingCycle: BillingCycle.MONTHLY,
      providerSessionId: 'bcs_1',
      expiresAt,
      amountIdr: 1_299_000,
    });
    mockPrisma.billingCheckoutSession.update.mockResolvedValue({
      id: 'checkout-1',
      providerCheckoutUrl:
        'https://api.sync-erp.test/api/billing/checkout/checkout-1',
    });

    await createBillingCheckoutSession({
      companyId: 'company-1',
      planKey: 'growth',
      billingCycle: BillingCycle.MONTHLY,
    });

    expect(mockPrisma.billingCheckoutSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'checkout-1' },
        data: expect.objectContaining({
          providerCheckoutUrl:
            'https://api.sync-erp.test/api/billing/checkout/checkout-1',
          successUrl:
            'https://app.sync-erp.test/settings/billing?checkout=success&checkoutSessionId=checkout-1',
          cancelUrl:
            'https://app.sync-erp.test/settings/billing?checkout=cancelled&checkoutSessionId=checkout-1',
        }),
      })
    );
  });
});
