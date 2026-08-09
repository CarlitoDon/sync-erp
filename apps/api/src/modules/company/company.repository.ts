import {
  Company,
  CompanyMember,
  BusinessShape,
  BillingProvider,
  BillingSubscriptionStatus,
  PermissionAction,
  PermissionModule,
  PermissionScope,
  Prisma,
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

const DEFAULT_ADMIN_PERMISSIONS: {
  module: PermissionModule;
  action: PermissionAction;
  scope: PermissionScope;
}[] = [
  {
    module: PermissionModule.COMPANY,
    action: PermissionAction.CREATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.COMPANY,
    action: PermissionAction.READ,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.COMPANY,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.COMPANY,
    action: PermissionAction.DELETE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.SALES,
    action: PermissionAction.CREATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.SALES,
    action: PermissionAction.READ,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.SALES,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.SALES,
    action: PermissionAction.DELETE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.SALES,
    action: PermissionAction.APPROVE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.PURCHASING,
    action: PermissionAction.CREATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.PURCHASING,
    action: PermissionAction.READ,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.PURCHASING,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.PURCHASING,
    action: PermissionAction.DELETE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.PURCHASING,
    action: PermissionAction.APPROVE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.INVENTORY,
    action: PermissionAction.CREATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.INVENTORY,
    action: PermissionAction.READ,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.INVENTORY,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.INVENTORY,
    action: PermissionAction.DELETE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.INVENTORY,
    action: PermissionAction.VOID,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.FINANCE,
    action: PermissionAction.CREATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.FINANCE,
    action: PermissionAction.READ,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.FINANCE,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.FINANCE,
    action: PermissionAction.DELETE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.FINANCE,
    action: PermissionAction.APPROVE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.FINANCE,
    action: PermissionAction.VOID,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.USERS,
    action: PermissionAction.CREATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.USERS,
    action: PermissionAction.READ,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.USERS,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.USERS,
    action: PermissionAction.DELETE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.RENTAL,
    action: PermissionAction.CREATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.RENTAL,
    action: PermissionAction.READ,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.RENTAL,
    action: PermissionAction.UPDATE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.RENTAL,
    action: PermissionAction.DELETE,
    scope: PermissionScope.ALL,
  },
  {
    module: PermissionModule.RENTAL,
    action: PermissionAction.APPROVE,
    scope: PermissionScope.ALL,
  },
];

async function ensureDefaultPermissions(
  tx: Prisma.TransactionClient
) {
  for (const permission of DEFAULT_ADMIN_PERMISSIONS) {
    await tx.permission.upsert({
      where: {
        module_action_scope: {
          module: permission.module,
          action: permission.action,
          scope: permission.scope,
        },
      },
      update: {},
      create: permission,
    });
  }

  return tx.permission.findMany({
    where: {
      OR: DEFAULT_ADMIN_PERMISSIONS.map((permission) => ({
        module: permission.module,
        action: permission.action,
        scope: permission.scope,
      })),
    },
    select: { id: true },
  });
}

export class CompanyRepository {
  /**
   * Serialize role mutations for one company.
   *
   * PostgreSQL's serializable isolation detects many write races, but the
   * company-row lock makes the owner invariant explicit and also protects
   * callers that only read the current owner set before updating a member.
   */
  async lockForMembershipMutation(
    tx: Prisma.TransactionClient,
    companyId: string
  ): Promise<void> {
    await tx.$executeRaw`
      SELECT id
      FROM "Company"
      WHERE id = ${companyId}
      FOR UPDATE
    `;
  }

  async create(data: {
    name: string;
    userId?: string;
  }): Promise<Company> {
    const now = new Date();
    const trialEndsAt = addDays(now, BILLING_TRIAL_DAYS);
    const isDefaultFreePlan = DEFAULT_BILLING_PLAN_KEY === 'free';

    return prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
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
        },
      });

      if (!data.userId) {
        return company;
      }

      const permissions = await ensureDefaultPermissions(tx);
      const adminRole = await tx.role.create({
        data: {
          companyId: company.id,
          name: 'Administrator',
        },
      });

      for (const permission of permissions) {
        await tx.rolePermission.create({
          data: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        });
      }

      await tx.companyMember.create({
        data: {
          userId: data.userId,
          companyId: company.id,
          roleId: adminRole.id,
        },
      });

      return company;
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

}
