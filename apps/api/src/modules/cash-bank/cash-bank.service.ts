import {
  CashBankRepository,
  CashTransactionWithRelations,
} from './cash-bank.repository';
import { AccountService } from '../accounting/services/account.service';
import { JournalService } from '../accounting/services/journal.service';
import {
  CreateBankAccountInput,
  UpdateBankAccountInput,
  CreateCashTransactionInput,
  UpdateCashTransactionInput,
  BankAccountTypeSchema,
} from '@sync-erp/shared';
import {
  prisma,
  BankAccount,
  CashTransaction,
  CashTransactionStatus,
  Account,
  Prisma,
  CashTransactionItem,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { CreateJournalLineInput } from '../accounting/services/journal.service';

export class CashBankService {
  constructor(
    private readonly repository: CashBankRepository,
    private readonly accountService: AccountService,
    private readonly journalService: JournalService
  ) {}

  // ============================================
  // Bank Accounts
  // ============================================

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

  // ============================================
  // Transactions
  // ============================================

  async createTransaction(
    companyId: string,
    data: CreateCashTransactionInput
  ): Promise<CashTransactionWithRelations> {
    // 1. Validation based on Type
    if (data.type === 'SPEND') {
      if (!data.sourceBankAccountId) {
        throw new DomainError(
          'Source bank account is required for SPEND transactions',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
      if (data.destinationBankAccountId) {
        throw new DomainError(
          'Destination bank account must be empty for SPEND transactions',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
      if (!data.items || data.items.length === 0) {
        throw new DomainError(
          'Expense items are required for SPEND transactions',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
    } else if (data.type === 'RECEIVE') {
      if (!data.destinationBankAccountId) {
        throw new DomainError(
          'Destination bank account is required for RECEIVE transactions',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
      if (data.sourceBankAccountId) {
        throw new DomainError(
          'Source bank account must be empty for RECEIVE transactions',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
      if (!data.items || data.items.length === 0) {
        throw new DomainError(
          'Income items are required for RECEIVE transactions',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
    } else if (data.type === 'TRANSFER') {
      if (
        !data.sourceBankAccountId ||
        !data.destinationBankAccountId
      ) {
        throw new DomainError(
          'Both source and destination accounts are required for TRANSFER',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
      if (
        data.sourceBankAccountId === data.destinationBankAccountId
      ) {
        throw new DomainError(
          'Source and destination accounts must be different',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
      if (!data.amount || data.amount <= 0) {
        throw new DomainError(
          'A positive amount is required for TRANSFER',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
    }

    // 2. Prepare Data
    const createData: Prisma.CashTransactionUncheckedCreateInput = {
      companyId,
      type: data.type,
      date: new Date(data.date),
      reference: data.reference,
      payee: data.payee,
      description: data.description,
      status: CashTransactionStatus.DRAFT,
      sourceBankAccountId: data.sourceBankAccountId,
      destinationBankAccountId: data.destinationBankAccountId,
      amount: data.amount || 0,
    };

    // 3. Handle Items and Total Calculation
    if (data.items && data.items.length > 0) {
      const totalAmount = data.items.reduce(
        (sum: number, item) => sum + item.amount,
        0
      );
      createData.amount = totalAmount;
      createData.items = {
        create: data.items.map((item) => ({
          accountId: item.accountId,
          description: item.description,
          amount: item.amount,
        })),
      };
    }

    return this.repository.createTransaction(createData);
  }

  async updateTransaction(
    id: string,
    companyId: string,
    data: UpdateCashTransactionInput
  ): Promise<CashTransactionWithRelations> {
    const transaction = await this.repository.getTransactionById(
      id,
      companyId
    );

    if (!transaction) {
      throw new DomainError(
        'Transaction not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    if (transaction.status !== CashTransactionStatus.DRAFT) {
      throw new DomainError(
        'Only DRAFT transactions can be updated',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    // Map input to repository format
    const updateData: Prisma.CashTransactionUpdateInput = {};
    if (data.date) updateData.date = new Date(data.date);
    if (data.reference !== undefined)
      updateData.reference = data.reference;
    if (data.payee !== undefined) updateData.payee = data.payee;
    if (data.description !== undefined)
      updateData.description = data.description;

    // For amount/items updates, we might need more complex logic (recreating items)
    // For MVP/Maintenance pass, we assume basic field updates or follow repository pattern
    // If items are provided, they should replace existing ones
    if (data.items) {
      updateData.items = {
        deleteMany: {},
        create: data.items.map((item) => ({
          accountId: item.accountId,
          description: item.description,
          amount: item.amount,
        })),
      };
      // Recalculate total if needed
      updateData.amount = data.items.reduce(
        (sum, item) => sum + Number(item.amount),
        0
      );
    }

    return this.repository.updateTransaction(
      id,
      companyId,
      updateData
    );
  }

  async postTransaction(
    id: string,
    companyId: string,
    _userId: string
  ): Promise<CashTransactionWithRelations> {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch Transaction
      const transaction = await this.repository.getTransactionById(
        id,
        companyId,
        tx
      );
      if (!transaction) {
        throw new DomainError(
          'Transaction not found',
          404,
          DomainErrorCodes.NOT_FOUND
        );
      }

      // 2. Validate Status
      if (transaction.status !== CashTransactionStatus.DRAFT) {
        throw new DomainError(
          'Only DRAFT transactions can be posted',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }

      // 3. Prepare Journal Lines
      const lines: CreateJournalLineInput[] = [];

      if (transaction.type === 'SPEND') {
        const sourceBank = transaction.sourceBank;
        if (!sourceBank)
          throw new Error('Source bank account not found');

        // Dr Expense (each item)
        transaction.items.forEach((item: CashTransactionItem) => {
          lines.push({
            accountId: item.accountId,
            debit: Number(item.amount),
            credit: 0,
          });
        });

        // Cr Bank
        lines.push({
          accountId: sourceBank.accountId,
          debit: 0,
          credit: Number(transaction.amount),
        });
      } else if (transaction.type === 'RECEIVE') {
        const destBank = transaction.destinationBank;
        if (!destBank)
          throw new Error('Destination bank account not found');

        // Dr Bank
        lines.push({
          accountId: destBank.accountId,
          debit: Number(transaction.amount),
          credit: 0,
        });

        // Cr Revenue (each item)
        transaction.items.forEach((item: CashTransactionItem) => {
          lines.push({
            accountId: item.accountId,
            debit: 0,
            credit: Number(item.amount),
          });
        });
      } else if (transaction.type === 'TRANSFER') {
        const sourceBank = transaction.sourceBank;
        const destBank = transaction.destinationBank;
        if (!sourceBank || !destBank)
          throw new Error('Bank accounts not found');

        // Dr Destination Bank
        lines.push({
          accountId: destBank.accountId,
          debit: Number(transaction.amount),
          credit: 0,
        });

        // Cr Source Bank
        lines.push({
          accountId: sourceBank.accountId,
          debit: 0,
          credit: Number(transaction.amount),
        });
      }

      // 4. Create Journal Entry
      const modeSuffix =
        transaction.type === 'SPEND'
          ? 'Payment'
          : transaction.type === 'RECEIVE'
            ? 'Receipt'
            : 'Transfer';

      const journal = await this.journalService.create(
        companyId,
        {
          date: transaction.date,
          reference: transaction.reference || `Cash/${modeSuffix}`,
          memo:
            transaction.description ||
            `Cash Transaction (${modeSuffix})`,
          sourceType: 'CASH_TRANSACTION',
          sourceId: transaction.id,
          lines,
        },
        tx
      );

      // 5. Update Transaction
      return tx.cashTransaction.update({
        where: { id },
        data: {
          status: CashTransactionStatus.POSTED,
          journalEntryId: journal.id,
        },
        include: {
          items: { include: { account: true } },
          sourceBank: { include: { account: true } },
          destinationBank: { include: { account: true } },
        },
      });
    });
  }

  async voidTransaction(
    id: string,
    companyId: string,
    reason: string,
    _userId: string
  ): Promise<CashTransaction> {
    if (!reason || reason.trim().length === 0) {
      throw new DomainError(
        'Void reason is required',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    return prisma.$transaction(async (tx) => {
      // 1. Fetch Transaction
      const transaction = await this.repository.getTransactionById(
        id,
        companyId,
        tx
      );
      if (!transaction) {
        throw new DomainError(
          'Transaction not found',
          404,
          DomainErrorCodes.NOT_FOUND
        );
      }

      // 2. Validate Status - only POSTED can be voided
      if (transaction.status !== CashTransactionStatus.POSTED) {
        throw new DomainError(
          'Only POSTED transactions can be voided',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }

      // 3. Create Reversal Journal Entry
      if (transaction.journalEntryId) {
        const originalJournal = await tx.journalEntry.findUnique({
          where: { id: transaction.journalEntryId },
          include: { lines: true },
        });

        if (originalJournal) {
          // Reverse all lines (swap debit/credit)
          const reversedLines: CreateJournalLineInput[] =
            originalJournal.lines.map((line) => ({
              accountId: line.accountId,
              debit: Number(line.credit),
              credit: Number(line.debit),
            }));

          await this.journalService.create(
            companyId,
            {
              date: new Date(),
              reference: `VOID: ${transaction.reference || id}`,
              memo: `Reversal: ${reason}`,
              sourceType: 'CASH_TRANSACTION',
              sourceId: `${id}:void`,
              lines: reversedLines,
            },
            tx
          );
        }
      }

      // 4. Update Transaction Status
      return tx.cashTransaction.update({
        where: { id },
        data: {
          status: CashTransactionStatus.VOIDED,
        },
      });
    });
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
    return this.repository.listTransactions(companyId, params);
  }

  async getTransaction(
    id: string,
    companyId: string
  ): Promise<CashTransactionWithRelations | null> {
    const tx = await this.repository.getTransactionById(
      id,
      companyId
    );
    if (tx && tx.companyId !== companyId) return null;
    return tx;
  }
}
