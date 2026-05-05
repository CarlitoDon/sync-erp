import { protectedProcedure, publicProcedure, router } from '../trpc';
import {
  BillingCycle,
  BillingProvider,
  prisma,
} from '@sync-erp/database';
import {
  BILLING_PLANS,
  BILLING_TRIAL_DAYS,
  BILLING_USAGE_METRICS,
  getBillingPlan,
  isBillingPlanKey,
} from '@sync-erp/shared';
import { z } from 'zod';
import {
  createBillingCheckoutSession,
  ensureCompanySubscription,
  getBillingProviderName,
  getBillingProvider,
  isBillingProviderConfigured,
  resolveBillingPlanKey,
} from '../../modules/billing/company-subscription.service';

function getCurrentMonthStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export const billingRouter = router({
  listPlans: publicProcedure.query(() => ({
    plans: BILLING_PLANS,
    trialDays: BILLING_TRIAL_DAYS,
  })),

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        planKey: z.string().refine((value) => isBillingPlanKey(value)),
        billingCycle: z.nativeEnum(BillingCycle).default(
          BillingCycle.MONTHLY
        ),
        successUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const company = await prisma.company.findUnique({
        where: { id: ctx.companyId },
        select: {
          id: true,
          createdAt: true,
        },
      });

      if (!company) {
        throw new Error('Company not found.');
      }

      await ensureCompanySubscription(company);

      const session = await createBillingCheckoutSession({
        companyId: ctx.companyId,
        planKey: input.planKey,
        billingCycle: input.billingCycle,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      });

      return {
        id: session.id,
        checkoutUrl: session.providerCheckoutUrl,
        provider: session.provider,
        billingCycle: session.billingCycle,
        planKey: session.planKey,
        status: session.status.toLowerCase(),
        expiresAt: session.expiresAt,
      };
    }),

  getOverview: protectedProcedure.query(async ({ ctx }) => {
    const monthStart = getCurrentMonthStart();

    const [
      company,
      existingSubscription,
      companyCount,
      users,
      products,
      orders,
      invoices,
      payments,
      rentalOrders,
      apiKeys,
    ] = await Promise.all([
      prisma.company.findUnique({
        where: { id: ctx.companyId },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      }),
      prisma.companySubscription.findUnique({
        where: { companyId: ctx.companyId },
      }),
      prisma.companyMember.count({
        where: { userId: ctx.userId },
      }),
      prisma.companyMember.count({
        where: { companyId: ctx.companyId },
      }),
      prisma.product.count({
        where: { companyId: ctx.companyId },
      }),
      prisma.order.count({
        where: {
          companyId: ctx.companyId,
          createdAt: { gte: monthStart },
        },
      }),
      prisma.invoice.count({
        where: {
          companyId: ctx.companyId,
          createdAt: { gte: monthStart },
        },
      }),
      prisma.payment.count({
        where: {
          companyId: ctx.companyId,
          createdAt: { gte: monthStart },
        },
      }),
      prisma.rentalOrder.count({
        where: {
          companyId: ctx.companyId,
          createdAt: { gte: monthStart },
        },
      }),
      prisma.apiKey.count({
        where: {
          companyId: ctx.companyId,
          isActive: true,
        },
      }),
    ]);

    const subscription =
      company &&
      (existingSubscription ??
        (await ensureCompanySubscription(company)));
    const currentPlanKey = resolveBillingPlanKey(
      subscription?.planKey
    );
    const currentPlan = getBillingPlan(currentPlanKey);
    const monthlyDocuments =
      orders + invoices + payments + rentalOrders;
    const trialEndsAt = subscription?.trialEndsAt ?? null;
    const status =
      subscription?.status?.toLowerCase() ?? 'trialing';
    const providerName = getBillingProviderName();

    return {
      company,
      status,
      trialEndsAt,
      currentPlanKey,
      currentPlan,
      plans: BILLING_PLANS,
      trialDays: BILLING_TRIAL_DAYS,
      subscription: subscription
        ? {
            id: subscription.id,
            provider: subscription.provider,
            planKey: currentPlanKey,
            status,
            trialStartsAt: subscription.trialStartsAt,
            trialEndsAt: subscription.trialEndsAt,
            currentPeriodStartsAt:
              subscription.currentPeriodStartsAt,
            currentPeriodEndsAt:
              subscription.currentPeriodEndsAt,
            graceEndsAt: subscription.graceEndsAt,
            cancelAtPeriodEnd:
              subscription.cancelAtPeriodEnd,
            canceledAt: subscription.canceledAt,
          }
        : null,
      metrics: BILLING_USAGE_METRICS,
      usage: {
        companies: companyCount,
        users,
        products,
        monthlyDocuments,
        apiKeys,
      },
      usageBreakdown: {
        orders,
        invoices,
        payments,
        rentalOrders,
      },
      paymentProvider: {
        configured: isBillingProviderConfigured(),
        provider: providerName,
        message:
          getBillingProvider() === BillingProvider.MANUAL
            ? 'Manual checkout sandbox is active. You can test upgrade flow end-to-end from this page.'
            : !isBillingProviderConfigured()
              ? `Billing provider ${providerName} is selected but not fully configured yet.`
            : `Billing provider ${providerName} is configured and ready for checkout activation.`,
      },
    };
  }),
});

export type BillingRouter = typeof billingRouter;
