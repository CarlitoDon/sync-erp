import {
  CashBankRepository,
  CashTransactionWithRelations,
} from './cash-bank.repository';
import { AccountService } from '../accounting/services/account.service';
import { JournalService } from '../accounting/services/journal.service';
import { CashAccountService } from './cash-account.service';
import { CashTransactionService } from './cash-transaction.service';
import {
  CreateBankAccountInput,
  UpdateBankAccountInput,
  CreateCashTransactionInput,
  UpdateCashTransactionInput,
} from '@sync-erp/shared';
import {
  BankAccount,
  CashTransaction,
  CashTransactionStatus,
  Account,
} from '@sync-erp/database';

export class CashBankService {
  private readonly accountSubService: CashAccountService;
  private readonly transactionSubService: CashTransactionService;

  constructor(
    repository: CashBankRepository,
    accountService: AccountService,
    journalService: JournalService
  ) {
    this.accountSubService = new CashAccountService(
      repository,
      accountService,
      journalService
    );
    this.transactionSubService = new CashTransactionService(
      repository,
      journalService
    );
  }

  // ============================================
  // Bank Accounts (Delegated)
  // ============================================

  async createAccount(
    companyId: string,
    data: CreateBankAccountInput
  ): Promise<BankAccount & { account: Account }> {
    return this.accountSubService.createAccount(companyId, data);
  }

  async updateAccount(
    id: string,
    companyId: string,
    data: UpdateBankAccountInput
  ): Promise<BankAccount & { account: Account }> {
    return this.accountSubService.updateAccount(id, companyId, data);
  }

  async listAccounts(
    companyId: string
  ): Promise<
    (BankAccount & { account: Account; balance: number })[]
  > {
    return this.accountSubService.listAccounts(companyId);
  }

  async getAccount(
    id: string,
    companyId: string
  ): Promise<BankAccount | null> {
    return this.accountSubService.getAccount(id, companyId);
  }

  // ============================================
  // Transactions (Delegated)
  // ============================================

  async createTransaction(
    companyId: string,
    data: CreateCashTransactionInput
  ): Promise<CashTransactionWithRelations> {
    return this.transactionSubService.createTransaction(
      companyId,
      data
    );
  }

  async updateTransaction(
    id: string,
    companyId: string,
    data: UpdateCashTransactionInput
  ): Promise<CashTransactionWithRelations> {
    return this.transactionSubService.updateTransaction(
      id,
      companyId,
      data
    );
  }

  async postTransaction(
    id: string,
    companyId: string,
    userId: string
  ): Promise<CashTransactionWithRelations> {
    return this.transactionSubService.postTransaction(
      id,
      companyId,
      userId
    );
  }

  async voidTransaction(
    id: string,
    companyId: string,
    reason: string,
    userId: string
  ): Promise<CashTransaction> {
    return this.transactionSubService.voidTransaction(
      id,
      companyId,
      reason,
      userId
    );
  }

  async listTransactions(
    companyId: string,
    params: {
      bankAccountId?: string;
      startDate?: Date;
      endDate?: Date;
      status?: CashTransactionStatus;
    }
  ): Promise<CashTransactionWithRelations[]> {
    return this.transactionSubService.listTransactions(
      companyId,
      params
    );
  }

  async getTransaction(
    id: string,
    companyId: string
  ): Promise<CashTransactionWithRelations | null> {
    return this.transactionSubService.getTransaction(id, companyId);
  }
}
