import { Account, AccountType } from '@sync-erp/database';
import { AccountRepository } from '../repositories/account.repository';

export class AccountService {
  private repository = new AccountRepository();

  async create(
    companyId: string,
    data: { code: string; name: string; type: AccountType }
  ): Promise<Account> {
    return this.repository.create({
      company: { connect: { id: companyId } },
      code: data.code,
      name: data.name,
      type: data.type,
    });
  }

  async getById(
    id: string,
    companyId: string
  ): Promise<Account | null> {
    return this.repository.findById(id, companyId);
  }

  async getByCode(
    companyId: string,
    code: string
  ): Promise<Account | null> {
    return this.repository.findByCode(code, companyId);
  }

  async list(
    companyId: string,
    type?: AccountType
  ): Promise<Account[]> {
    return this.repository.findAll(companyId, type);
  }

  async update(
    id: string,
    companyId: string,
    data: { name?: string; isActive?: boolean }
  ): Promise<Account> {
    const existing = await this.repository.findById(id, companyId);
    if (!existing) {
      throw new Error('Account not found');
    }
    return this.repository.update(id, data);
  }

  async seedDefaultAccounts(companyId: string): Promise<Account[]> {
    const defaultAccounts = [
      // Assets (1xxx)
      { code: '1100', name: 'Cash', type: AccountType.ASSET },
      { code: '1200', name: 'Bank', type: AccountType.ASSET },
      {
        code: '1300',
        name: 'Accounts Receivable',
        type: AccountType.ASSET,
      },
      { code: '1400', name: 'Inventory', type: AccountType.ASSET },
      {
        code: '1500',
        name: 'Prepaid Expenses',
        type: AccountType.ASSET,
      },

      // Liabilities (2xxx)
      {
        code: '2100',
        name: 'Accounts Payable',
        type: AccountType.LIABILITY,
      },
      {
        code: '2105',
        name: 'Unbilled Liability',
        type: AccountType.LIABILITY,
      },
      {
        code: '2200',
        name: 'Accrued Expenses',
        type: AccountType.LIABILITY,
      },
      {
        code: '2300',
        name: 'VAT Payable',
        type: AccountType.LIABILITY,
      },

      // Equity (3xxx)
      {
        code: '3100',
        name: 'Retained Earnings',
        type: AccountType.EQUITY,
      },
      {
        code: '3200',
        name: 'Owner Capital',
        type: AccountType.EQUITY,
      },

      // Revenue (4xxx)
      {
        code: '4100',
        name: 'Sales Revenue',
        type: AccountType.REVENUE,
      },
      {
        code: '4200',
        name: 'Service Revenue',
        type: AccountType.REVENUE,
      },
      {
        code: '4900',
        name: 'Other Income',
        type: AccountType.REVENUE,
      },

      // Expenses (5xxx)
      {
        code: '5000',
        name: 'Cost of Goods Sold',
        type: AccountType.EXPENSE,
      }, // Added 5000 based on usage in JournalService
      {
        code: '5100',
        name: 'Operating Expenses',
        type: AccountType.EXPENSE,
      }, // Generalized or specific
      {
        code: '5200',
        name: 'Inventory Adjustment',
        type: AccountType.EXPENSE,
      }, // Added for stock adjustment
      {
        code: '5300',
        name: 'Rent Expense',
        type: AccountType.EXPENSE,
      },
      {
        code: '5400',
        name: 'Utilities Expense',
        type: AccountType.EXPENSE,
      },
      {
        code: '5900',
        name: 'Other Expenses',
        type: AccountType.EXPENSE,
      },
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
