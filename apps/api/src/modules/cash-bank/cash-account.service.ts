import { CashBankRepository } from './cash-bank.repository';
import { AccountService } from '../accounting/services/account.service';
import { JournalService } from '../accounting/services/journal.service';
import {
  CreateBankAccountInput,
  UpdateBankAccountInput,
  BankAccountTypeSchema,
} from '@sync-erp/shared';
import { BankAccount, Account } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

export class CashAccountService {
  constructor(
    private readonly repository: CashBankRepository,
    private readonly accountService: AccountService,
    private readonly journalService: JournalService
  ) {}

  async createAccount(
    companyId: string,
    data: CreateBankAccountInput
  ): Promise<BankAccount & { account: Account }> {
    // 1. Auto-create Sub-Account based on Type
    const parentCode =
      data.accountType === BankAccountTypeSchema.enum.CASH
        ? '1100'
        : '1200';

    // Auto-generate code and create GL Account
    const glAccount = await this.accountService.createSubAccount(
      companyId,
      parentCode,
      data.bankName
    );
    const glAccountId = glAccount.id;

    // 2. Validate Uniqueness (Basic check)
    // Note: createSubAccount already ensures the GL Account is new and unique by code
    const existing = await this.repository.getAccountByGlAccountId(
      glAccountId,
      companyId
    );
    if (existing) {
      throw new DomainError(
        'Bank Account already linked to this GL Account',
        409,
        DomainErrorCodes.ALREADY_EXISTS
      );
    }

    // 3. Create Bank Account
    return this.repository.createAccount({
      companyId,
      accountId: glAccountId!,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      currency: data.currency,
    });
  }

  async updateAccount(
    id: string,
    companyId: string,
    data: UpdateBankAccountInput
  ): Promise<BankAccount & { account: Account }> {
    // Basic validation
    const account = await this.repository.getAccountById(
      id,
      companyId
    );
    if (!account || account.companyId !== companyId) {
      throw new DomainError(
        'Bank Account not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    return this.repository.updateAccount(id, companyId, {
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      isArchived: data.isArchived,
    });
  }

  async listAccounts(
    companyId: string
  ): Promise<
    (BankAccount & { account: Account; balance: number })[]
  > {
    const accounts = await this.repository.listAccounts(companyId);

    const withBalances = await Promise.all(
      accounts.map(async (acc) => {
        const balance = await this.journalService.getAccountBalance(
          acc.accountId
        );
        return {
          ...acc,
          balance,
        };
      })
    );

    return withBalances;
  }

  async getAccount(
    id: string,
    companyId: string
  ): Promise<BankAccount | null> {
    const account = await this.repository.getAccountById(
      id,
      companyId
    );
    if (account && account.companyId !== companyId) return null;
    return account;
  }
}
