import {
  Company,
  CompanyMember,
  BusinessShape,
  CompanyOnboardingStatus,
  CompanyOnboardingStep,
  Prisma,
  prisma,
} from '@sync-erp/database';
import { CompanyRepository } from './company.repository';
import { CompanyPolicy } from './company.policy';
import { InventoryPolicy } from '../inventory/inventory.policy';
import { container, ServiceKeys } from '../common/di';
import { AccountService } from '../accounting/services/account.service';
import {
  CreateCompanyDto,
  JoinCompanyDto,
  DomainError,
  DomainErrorCodes,
} from '@sync-erp/shared';
import {
  canAssignRole,
  isPrivilegedRole,
  normalizeRole,
} from '../auth/rbac.policy';

const MEMBERSHIP_MUTATION_MAX_ATTEMPTS = 3;

function isRetryableMembershipMutationConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === 'P2034' || code === '40001' || code === '40P01';
}

export class CompanyService {
  constructor(
    private readonly repository: CompanyRepository = new CompanyRepository()
  ) {}

  async create(
    data: CreateCompanyDto,
    userId?: string
  ): Promise<Company> {
    return this.repository.create({ name: data.name, userId });
  }

  async join(data: JoinCompanyDto, userId: string): Promise<Company> {
    const company = await this.repository.findByInviteCode(
      data.inviteCode
    );

    if (!company) {
      throw new DomainError(
        'Invalid invite code',
        400,
        DomainErrorCodes.NOT_FOUND
      );
    }

    const membership = await this.repository.findMembership(
      userId,
      company.id
    );
    if (membership) {
      throw new DomainError(
        'User is already a member of this company',
        409,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    await this.repository.addMember(userId, company.id);

    return company;
  }

  async getById(id: string): Promise<Company | null> {
    const company = await this.repository.findById(id);
    if (
      company &&
      company.businessShape !== BusinessShape.PENDING &&
      company.onboardingStatus === CompanyOnboardingStatus.NOT_INITIALIZED
    ) {
      return prisma.company.update({
        where: { id: company.id },
        data: {
          onboardingStatus: CompanyOnboardingStatus.ACTIVE,
          onboardingStep: CompanyOnboardingStep.DONE,
          onboardingCompletedAt: company.onboardingCompletedAt ?? new Date(),
        },
      });
    }
    return company;
  }

  async listForUser(userId: string): Promise<Company[]> {
    const memberships = await this.repository.findMemberships(userId);
    const companies = memberships.map((m) => m.company);

    const promoteIds = companies
      .filter(
        (company) =>
          company.businessShape !== BusinessShape.PENDING &&
          company.onboardingStatus === CompanyOnboardingStatus.NOT_INITIALIZED
      )
      .map((company) => company.id);

    if (promoteIds.length) {
      await prisma.company.updateMany({
        where: { id: { in: promoteIds } },
        data: {
          onboardingStatus: CompanyOnboardingStatus.ACTIVE,
          onboardingStep: CompanyOnboardingStep.DONE,
          onboardingCompletedAt: new Date(),
        },
      });

      return companies.map((company) =>
        promoteIds.includes(company.id)
          ? {
              ...company,
              onboardingStatus: CompanyOnboardingStatus.ACTIVE,
              onboardingStep: CompanyOnboardingStep.DONE,
              onboardingCompletedAt: company.onboardingCompletedAt ?? new Date(),
            }
          : company
      );
    }

    return companies;
  }

  async isMember(
    userId: string,
    companyId: string
  ): Promise<boolean> {
    const membership = await this.repository.findMembership(
      userId,
      companyId
    );
    return !!membership;
  }

  async updateMemberRole(
    companyId: string,
    targetUserId: string,
    roleId: string,
    actorId: string
  ): Promise<CompanyMember> {
    return this.runMembershipMutation(companyId, async (tx) => {
      const { actorRole, targetRole: currentRole } =
        await this.loadMembershipMutationContext(
          tx,
          companyId,
          targetUserId,
          actorId
        );

      const targetRole = await tx.role.findFirst({
        where: { id: roleId, companyId },
        select: { id: true, name: true },
      });

      if (!targetRole) {
        throw new DomainError(
          'Role does not belong to this company',
          403,
          DomainErrorCodes.FORBIDDEN
        );
      }

      const nextRole = normalizeRole(targetRole.name);
      if (!canAssignRole(actorRole, nextRole)) {
        throw new DomainError(
          'Only a privileged role may assign an administrative role',
          403,
          DomainErrorCodes.FORBIDDEN
        );
      }

      if (
        targetUserId === actorId &&
        isPrivilegedRole(currentRole) &&
        !isPrivilegedRole(nextRole)
      ) {
        throw new DomainError(
          'Self-demotion would remove the actor\'s administrative access',
          403,
          DomainErrorCodes.FORBIDDEN
        );
      }

      await this.assertOwnerRetained(
        tx,
        companyId,
        targetUserId,
        currentRole,
        nextRole
      );

      return tx.companyMember.update({
        where: {
          userId_companyId: {
            userId: targetUserId,
            companyId,
          },
        },
        data: { roleId: targetRole.id },
      });
    });
  }

  async removeMember(
    companyId: string,
    targetUserId: string,
    actorId: string
  ): Promise<CompanyMember> {
    return this.runMembershipMutation(companyId, async (tx) => {
      const { targetRole: currentRole } =
        await this.loadMembershipMutationContext(
          tx,
          companyId,
          targetUserId,
          actorId
        );

      if (targetUserId === actorId) {
        throw new DomainError(
          'Self-removal would remove the actor\'s administrative access',
          403,
          DomainErrorCodes.FORBIDDEN
        );
      }

      await this.assertOwnerRetained(
        tx,
        companyId,
        targetUserId,
        currentRole
      );

      return tx.companyMember.delete({
        where: {
          userId_companyId: {
            userId: targetUserId,
            companyId,
          },
        },
      });
    });
  }

  private async runMembershipMutation<T>(
    companyId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    for (
      let attempt = 1;
      attempt <= MEMBERSHIP_MUTATION_MAX_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            // Update and removal paths take the same per-company row lock
            // before reading role/owner state.
            await this.repository.lockForMembershipMutation(tx, companyId);
            return operation(tx);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        if (
          !isRetryableMembershipMutationConflict(error) ||
          attempt === MEMBERSHIP_MUTATION_MAX_ATTEMPTS
        ) {
          throw error;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 10)
        );
      }
    }

    throw new Error('Membership mutation retry budget exhausted');
  }

  private async loadMembershipMutationContext(
    tx: Prisma.TransactionClient,
    companyId: string,
    targetUserId: string,
    actorId: string
  ): Promise<{ actorRole: string; targetRole: string | undefined }> {
    const actorMembership = await tx.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId: actorId,
          companyId,
        },
      },
      select: {
        role: { select: { name: true } },
      },
    });

    if (
      !actorMembership?.role ||
      !isPrivilegedRole(actorMembership.role.name)
    ) {
      throw new DomainError(
        'Privileged role required for membership management',
        403,
        DomainErrorCodes.FORBIDDEN
      );
    }

    const targetMembership = await tx.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId: targetUserId,
          companyId,
        },
      },
      select: {
        role: { select: { name: true } },
      },
    });

    if (!targetMembership) {
      throw new DomainError(
        'User is not a member of this company',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    return {
      actorRole: actorMembership.role.name,
      targetRole: normalizeRole(targetMembership.role?.name),
    };
  }

  private async assertOwnerRetained(
    tx: Prisma.TransactionClient,
    companyId: string,
    targetUserId: string,
    currentRole: string | undefined,
    nextRole?: string
  ): Promise<void> {
    if (currentRole !== 'OWNER' || nextRole === 'OWNER') {
      return;
    }

    const remainingOwner = await tx.companyMember.findFirst({
      where: {
        companyId,
        userId: { not: targetUserId },
        role: {
          name: {
            equals: 'OWNER',
            mode: 'insensitive',
          },
        },
      },
      select: { userId: true },
    });

    if (!remainingOwner) {
      throw new DomainError(
        'The company must retain at least one owner',
        403,
        DomainErrorCodes.FORBIDDEN
      );
    }
  }

  /**
   * Select business shape for a company.
   * This is a ONE-TIME operation - shape becomes immutable after selection.
   *
   * @param companyId - Company ID
   * @param newShape - Target business shape (RETAIL, MANUFACTURING, SERVICE, RENTAL)
   * @param currentShape - Current shape for Policy check
   */
  async selectShape(
    companyId: string,
    newShape: BusinessShape,
    currentShape: BusinessShape
  ): Promise<Company> {
    // Policy check - ensure shape can be changed
    CompanyPolicy.ensureCanSelectShape(currentShape);
    CompanyPolicy.ensureValidTargetShape(newShape);

    // Update shape
    const updated = await this.repository.updateShape(
      companyId,
      newShape
    );

    // Auto-seed configuration for the selected shape
    await this.seedSystemConfig(companyId, newShape);

    // Auto-seed Chart of Accounts for the selected shape
    await this.seedChartOfAccounts(companyId, newShape);

    return updated;
  }

  /**
   * Seed default SystemConfig entries for a shape.
   */
  private async seedSystemConfig(
    companyId: string,
    shape: BusinessShape
  ): Promise<void> {
    const defaultCostingMethod =
      InventoryPolicy.getDefaultCostingMethod(shape);

    const configs = [
      {
        key: 'inventory.enabled',
        value: shape !== BusinessShape.SERVICE,
      },
      {
        key: 'inventory.costing_method',
        value: defaultCostingMethod || 'AVG',
      },
      {
        key: 'inventory.multi_warehouse',
        value: shape === BusinessShape.MANUFACTURING,
      },
      {
        key: 'inventory.wip_enabled',
        value: shape === BusinessShape.MANUFACTURING,
      },
    ];

    for (const config of configs) {
      const existing = await prisma.systemConfig.findFirst({
        where: {
          companyId,
          key: config.key,
        },
      });

      if (existing) {
        await prisma.systemConfig.update({
          where: { id: existing.id },
          data: { value: config.value },
        });
      } else {
        await prisma.systemConfig.create({
          data: {
            companyId,
            key: config.key,
            value: config.value,
          },
        });
      }
    }
  }

  /**
   * Seed minimal Chart of Accounts for a shape.
   */
  private async seedChartOfAccounts(
    companyId: string,
    shape: BusinessShape
  ): Promise<void> {
    // Check if CoA already exists
    const existingAccounts = await prisma.account.count({
      where: { companyId },
    });

    if (existingAccounts > 0) {
      // CoA already seeded, skip
      return;
    }

    // Minimal CoA based on shape
    const baseAccounts = [
      { code: '1000', name: 'Cash', type: 'ASSET' as const },
      {
        code: '1100',
        name: 'Accounts Receivable',
        type: 'ASSET' as const,
      },
      {
        code: '2000',
        name: 'Accounts Payable',
        type: 'LIABILITY' as const,
      },
      { code: '3000', name: 'Equity', type: 'EQUITY' as const },
      {
        code: '4000',
        name: 'Sales Revenue',
        type: 'REVENUE' as const,
      },
      {
        code: '5000',
        name: 'Cost of Goods Sold',
        type: 'EXPENSE' as const,
      },
      {
        code: '6000',
        name: 'Operating Expenses',
        type: 'EXPENSE' as const,
      },
    ];

    // Add inventory accounts for non-service shapes
    const inventoryAccounts =
      shape !== BusinessShape.SERVICE
        ? [
            {
              code: '1200',
              name: 'Inventory',
              type: 'ASSET' as const,
            },
            {
              code: '1210',
              name: 'Goods in Transit',
              type: 'ASSET' as const,
            },
            {
              code: '5200',
              name: 'Inventory Adjustment',
              type: 'EXPENSE' as const,
            },
          ]
        : [];

    // Add manufacturing accounts
    const manufacturingAccounts =
      shape === BusinessShape.MANUFACTURING
        ? [
            {
              code: '1220',
              name: 'Work in Progress',
              type: 'ASSET' as const,
            },
            {
              code: '1230',
              name: 'Raw Materials',
              type: 'ASSET' as const,
            },
          ]
        : [];

    const allAccounts = [
      ...baseAccounts,
      ...inventoryAccounts,
      ...manufacturingAccounts,
    ];

    for (const account of allAccounts) {
      await prisma.account.create({
        data: {
          companyId,
          code: account.code,
          name: account.name,
          type: account.type,
        },
      });
    }

    // Add the standard default accounts as a second pass so newly created
    // companies can immediately post procurement and sales journals.
    const accountService = container.resolve<AccountService>(
      ServiceKeys.ACCOUNT_SERVICE
    );
    await accountService.seedDefaultAccounts(companyId);
  }
}
