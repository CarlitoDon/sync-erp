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
  getBillingWebhookSecret,
  getMidtransConfigurationErrors,
  isBillingProviderConfigured,
} from '../../src/modules/billing/company-subscription.service';

const originalEnv = { ...process.env };

describe('company subscription service', () => {
  beforeEach(() => {
    mockPrisma.companySubscription.upsert.mockResolvedValue({
      id: 'subscription-1',
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
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

  it('keeps the manual billing webhook fallback limited to development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.BILLING_WEBHOOK_SECRET;
    delete process.env.SYNC_ERP_BOT_SECRET;

    expect(getBillingWebhookSecret()).toBe('dev-billing-webhook-secret');
  });

  it('requires an explicit manual billing webhook secret in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.BILLING_WEBHOOK_SECRET;
    process.env.SYNC_ERP_BOT_SECRET = 'bot-secret-should-not-be-used';

    expect(() => getBillingWebhookSecret()).toThrow(
      'BILLING_WEBHOOK_SECRET must be configured in production or staging.'
    );
  });

  it('uses the explicit manual billing webhook secret in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.BILLING_WEBHOOK_SECRET = 'billing-webhook-secret';

    expect(getBillingWebhookSecret()).toBe('billing-webhook-secret');
  });

  it('rejects Midtrans production-like keys when sandbox mode is selected', () => {
    process.env.BILLING_PROVIDER = 'MIDTRANS';
    process.env.MIDTRANS_IS_PRODUCTION = 'false';
    process.env.MIDTRANS_SERVER_KEY = 'Mid-server-example';
    process.env.MIDTRANS_CLIENT_KEY = 'Mid-client-example';

    expect(isBillingProviderConfigured()).toBe(false);
    expect(getMidtransConfigurationErrors()).toEqual([
      'MIDTRANS_SERVER_KEY appears to be a production key while MIDTRANS_IS_PRODUCTION=false.',
      'MIDTRANS_CLIENT_KEY appears to be a production key while MIDTRANS_IS_PRODUCTION=false.',
    ]);
  });

  it('blocks unsafe Midtrans checkout before creating a session', async () => {
    process.env.BILLING_PROVIDER = 'MIDTRANS';
    process.env.MIDTRANS_IS_PRODUCTION = 'false';
    process.env.MIDTRANS_SERVER_KEY = 'Mid-server-example';
    process.env.MIDTRANS_CLIENT_KEY = 'Mid-client-example';

    await expect(
      createBillingCheckoutSession({
        companyId: 'company-1',
        planKey: 'growth',
        billingCycle: BillingCycle.MONTHLY,
      })
    ).rejects.toThrow('Midtrans configuration is not safe for checkout');
    expect(
      mockPrisma.billingCheckoutSession.create
    ).not.toHaveBeenCalled();
  });

  it('accepts matching Midtrans production key mode for live deploys', () => {
    process.env.BILLING_PROVIDER = 'MIDTRANS';
    process.env.MIDTRANS_IS_PRODUCTION = 'true';
    process.env.MIDTRANS_SERVER_KEY = 'Mid-server-example';
    process.env.MIDTRANS_CLIENT_KEY = 'Mid-client-example';

    expect(isBillingProviderConfigured()).toBe(true);
    expect(getMidtransConfigurationErrors()).toEqual([]);
  });

  it('rejects Midtrans sandbox keys when production mode is selected', () => {
    process.env.BILLING_PROVIDER = 'MIDTRANS';
    process.env.MIDTRANS_IS_PRODUCTION = 'true';
    process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-example';
    process.env.MIDTRANS_CLIENT_KEY = 'SB-Mid-client-example';

    expect(isBillingProviderConfigured()).toBe(false);
    expect(getMidtransConfigurationErrors()).toEqual([
      'MIDTRANS_SERVER_KEY appears to be a sandbox key while MIDTRANS_IS_PRODUCTION=true.',
      'MIDTRANS_CLIENT_KEY appears to be a sandbox key while MIDTRANS_IS_PRODUCTION=true.',
    ]);
  });
});
