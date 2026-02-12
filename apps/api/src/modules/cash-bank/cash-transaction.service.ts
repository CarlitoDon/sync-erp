import {
  CashBankRepository,
  CashTransactionWithRelations,
} from './cash-bank.repository';
import {
  JournalService,
  CreateJournalLineInput,
} from '../accounting/services/journal.service';
import { CashBankPolicy } from './cash-bank.policy';
import {
  CreateCashTransactionInput,
  UpdateCashTransactionInput,
} from '@sync-erp/shared';
import {
  prisma,
  CashTransaction,
  CashTransactionStatus,
  Prisma,
  CashTransactionItem,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

export class CashTransactionService {
  constructor(
    private readonly repository: CashBankRepository,
    private readonly journalService: JournalService
  ) {}

  async createTransaction(
    companyId: string,
    data: CreateCashTransactionInput
  ): Promise<CashTransactionWithRelations> {
    // 1. Validation check using Policy
    CashBankPolicy.ensureValidCreateInput(data);

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

    CashBankPolicy.ensureCanUpdateTransaction(transaction.status);

    // Map input to repository format
    const updateData: Prisma.CashTransactionUpdateInput = {};
    if (data.date) updateData.date = new Date(data.date);
    if (data.reference !== undefined)
      updateData.reference = data.reference;
    if (data.payee !== undefined) updateData.payee = data.payee;
    if (data.description !== undefined)
      updateData.description = data.description;

    // Items update
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
      CashBankPolicy.ensureCanPostTransaction(transaction.status);

      // 3. Prepare Journal Lines
      const lines: CreateJournalLineInput[] = [];

      if (transaction.type === 'SPEND') {
        const sourceBank = transaction.sourceBank;
        if (!sourceBank)
          throw new DomainError(
            'Source bank account not found',
            400,
            DomainErrorCodes.INVALID_INPUT
          );

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
          throw new DomainError(
            'Destination bank account not found',
            400,
            DomainErrorCodes.INVALID_INPUT
          );

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
          throw new DomainError(
            'Bank accounts not found',
            400,
            DomainErrorCodes.INVALID_INPUT
          );

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
    CashBankPolicy.ensureValidVoidReason(reason);

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
      CashBankPolicy.ensureCanVoidTransaction(transaction.status);

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
