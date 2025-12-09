import { prisma, AccountType } from '@sync-erp/database';

// Define Account interface locally to avoid stale cache issues
interface Account {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: AccountType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
}

interface UpdateAccountInput {
  name?: string;
  isActive?: boolean;
}

export class AccountService {
  /**
   * Create a new account (chart of accounts)
   */
  async create(companyId: string, data: CreateAccountInput): Promise<Account> {
    return prisma.account.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        type: data.type,
      },
    });
  }

  /**
   * Get account by ID
   */
  async getById(id: string, companyId: string): Promise<Account | null> {
    return prisma.account.findFirst({
      where: { id, companyId },
    });
  }

  /**
   * Get account by code
   */
  async getByCode(companyId: string, code: string): Promise<Account | null> {
    return prisma.account.findFirst({
      where: { companyId, code },
    });
  }

  /**
   * List all accounts for a company
   */
  async list(companyId: string, type?: AccountType): Promise<Account[]> {
    return prisma.account.findMany({
      where: {
        companyId,
        ...(type && { type }),
      },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Update an account
   */
  async update(id: string, _companyId: string, data: UpdateAccountInput): Promise<Account> {
    return prisma.account.update({
      where: { id },
      data,
    });
  }

  /**
   * Seed default chart of accounts for a company
   */
  async seedDefaultAccounts(companyId: string): Promise<Account[]> {
    const defaultAccounts = [
      // Assets (1xxx)
      { code: '1100', name: 'Cash', type: AccountType.ASSET },
      { code: '1200', name: 'Bank', type: AccountType.ASSET },
      { code: '1300', name: 'Accounts Receivable', type: AccountType.ASSET },
      { code: '1400', name: 'Inventory', type: AccountType.ASSET },
      { code: '1500', name: 'Prepaid Expenses', type: AccountType.ASSET },

      // Liabilities (2xxx)
      { code: '2100', name: 'Accounts Payable', type: AccountType.LIABILITY },
      { code: '2200', name: 'Accrued Expenses', type: AccountType.LIABILITY },
      { code: '2300', name: 'VAT Payable', type: AccountType.LIABILITY },

      // Equity (3xxx)
      { code: '3100', name: 'Retained Earnings', type: AccountType.EQUITY },
      { code: '3200', name: 'Owner Capital', type: AccountType.EQUITY },

      // Revenue (4xxx)
      { code: '4100', name: 'Sales Revenue', type: AccountType.REVENUE },
      { code: '4200', name: 'Service Revenue', type: AccountType.REVENUE },
      { code: '4900', name: 'Other Income', type: AccountType.REVENUE },

      // Expenses (5xxx)
      { code: '5100', name: 'Cost of Goods Sold', type: AccountType.EXPENSE },
      { code: '5200', name: 'Salaries Expense', type: AccountType.EXPENSE },
      { code: '5300', name: 'Rent Expense', type: AccountType.EXPENSE },
      { code: '5400', name: 'Utilities Expense', type: AccountType.EXPENSE },
      { code: '5900', name: 'Other Expenses', type: AccountType.EXPENSE },
    ];

    const accounts: Account[] = [];
    for (const acc of defaultAccounts) {
      const existing = await this.getByCode(companyId, acc.code);
      if (!existing) {
        const created = await this.create(companyId, acc);
        accounts.push(created);
      }
    }
    return accounts;
  }
}
