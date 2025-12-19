import { Company, BusinessShape, prisma } from '@sync-erp/database';
import { CompanyRepository } from './company.repository';
import { CompanyPolicy } from './company.policy';
import { InventoryPolicy } from '../inventory/inventory.policy';
import { CreateCompanyDto, JoinCompanyDto } from '@sync-erp/shared';

export class CompanyService {
  private repository = new CompanyRepository();

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
      throw new Error('Invalid invite code');
    }

    const membership = await this.repository.findMembership(
      userId,
      company.id
    );
    if (membership) {
      throw new Error('User is already a member of this company');
    }

    await this.repository.addMember(userId, company.id);

    return company;
  }

  async getById(id: string): Promise<Company | null> {
    return this.repository.findById(id);
  }

  async listForUser(userId: string): Promise<Company[]> {
    const memberships = await this.repository.findMemberships(userId);
    return memberships.map((m) => m.company);
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

  /**
   * Select business shape for a company.
   * This is a ONE-TIME operation - shape becomes immutable after selection.
   *
   * @param companyId - Company ID
   * @param newShape - Target business shape (RETAIL, MANUFACTURING, SERVICE)
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
  }
}
