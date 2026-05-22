import {
  Company,
  CompanyMember,
  BusinessShape,
  BillingProvider,
  BillingSubscriptionStatus,
} from '@sync-erp/database';
import { prisma } from '@sync-erp/database';
import {
  BILLING_TRIAL_DAYS,
  DEFAULT_BILLING_PLAN_KEY,
} from '@sync-erp/shared';

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export class CompanyRepository {
  async create(data: {
    name: string;
    userId?: string;
  }): Promise<Company> {
    const now = new Date();
    const trialEndsAt = addDays(now, BILLING_TRIAL_DAYS);
    const isDefaultFreePlan = DEFAULT_BILLING_PLAN_KEY === 'free';

    return prisma.company.create({
      data: {
        name: data.name,
        subscription: {
          create: {
            planKey: DEFAULT_BILLING_PLAN_KEY,
            status: isDefaultFreePlan
              ? BillingSubscriptionStatus.ACTIVE
              : BillingSubscriptionStatus.TRIALING,
            provider: BillingProvider.MANUAL,
            trialStartsAt: isDefaultFreePlan ? null : now,
            trialEndsAt: isDefaultFreePlan ? null : trialEndsAt,
            currentPeriodStartsAt: now,
            currentPeriodEndsAt: isDefaultFreePlan
              ? null
              : trialEndsAt,
          },
        },
        ...(data.userId && {
          members: {
            create: {
              userId: data.userId,
            },
          },
        }),
      },
      include: {
        members: !!data.userId,
      },
    });
  }

  async findByInviteCode(
    inviteCode: string
  ): Promise<Company | null> {
    return prisma.company.findUnique({
      where: { inviteCode },
    });
  }

  async findById(id: string): Promise<Company | null> {
    return prisma.company.findUnique({
      where: { id },
    });
  }

  async findMembership(
    userId: string,
    companyId: string
  ): Promise<CompanyMember | null> {
    return prisma.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
    });
  }

  async addMember(
    userId: string,
    companyId: string
  ): Promise<CompanyMember> {
    return prisma.companyMember.create({
      data: {
        userId,
        companyId,
      },
    });
  }

  async findMemberships(
    userId: string
  ): Promise<(CompanyMember & { company: Company })[]> {
    return prisma.companyMember.findMany({
      where: { userId },
      include: {
        company: true,
      },
    });
  }

  /**
   * Update company businessShape (immutable once set from PENDING).
   */
  async updateShape(
    companyId: string,
    shape: BusinessShape
  ): Promise<Company> {
    return prisma.company.update({
      where: { id: companyId },
      data: { businessShape: shape },
    });
  }

  async updateMemberRole(
    companyId: string,
    userId: string,
    roleId: string
  ): Promise<CompanyMember> {
    return prisma.companyMember.update({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
      data: { roleId },
    });
  }
}
