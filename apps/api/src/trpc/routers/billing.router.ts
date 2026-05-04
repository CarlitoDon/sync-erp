import { protectedProcedure, publicProcedure, router } from '../trpc';
import { prisma } from '@sync-erp/database';
import {
  BILLING_PLANS,
  BILLING_TRIAL_DAYS,
  BILLING_USAGE_METRICS,
  DEFAULT_BILLING_PLAN_KEY,
  getBillingPlan,
} from '@sync-erp/shared';

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getCurrentMonthStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export const billingRouter = router({
  listPlans: publicProcedure.query(() => ({
    plans: BILLING_PLANS,
    trialDays: BILLING_TRIAL_DAYS,
  })),

  getOverview: protectedProcedure.query(async ({ ctx }) => {
    const monthStart = getCurrentMonthStart();

    const [
      company,
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

    const currentPlan = getBillingPlan(DEFAULT_BILLING_PLAN_KEY);
    const monthlyDocuments =
      orders + invoices + payments + rentalOrders;
    const trialEndsAt = company
      ? addDays(company.createdAt, BILLING_TRIAL_DAYS)
      : null;

    return {
      company,
      status: 'trialing' as const,
      trialEndsAt,
      currentPlanKey: currentPlan.key,
      currentPlan,
      plans: BILLING_PLANS,
      trialDays: BILLING_TRIAL_DAYS,
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
        configured: false,
        provider: null as string | null,
        message:
          'Payment collection is not connected yet. Plans and limits are ready for checkout integration.',
      },
    };
  }),
});

export type BillingRouter = typeof billingRouter;
