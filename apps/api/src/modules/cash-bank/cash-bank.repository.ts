import {
  prisma,
  BankAccount,
  CashTransaction,
  CashTransactionStatus,
  Prisma,
  Account,
  CashTransactionItem,
} from '@sync-erp/database';

export type CashTransactionWithRelations = CashTransaction & {
  items: (CashTransactionItem & { account?: Account })[];
  sourceBank?: (BankAccount & { account: Account }) | null;
  destinationBank?: (BankAccount & { account: Account }) | null;
};

export class CashBankRepository {
  // ============================================
  // Bank Account
  // ============================================

  async createAccount(
    data: Prisma.BankAccountUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<BankAccount & { account: Account }> {
    const client = tx || prisma;
    return client.bankAccount.create({
      data,
      include: {
        account: true, // Include GL Account details
      },
    });
  }

  async updateAccount(
    id: string,
    companyId: string,
    data: Prisma.BankAccountUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<BankAccount & { account: Account }> {
    const client = tx || prisma;
    return client.bankAccount.update({
      where: {
        id,
        companyId,
      },
      data,
      include: { account: true },
    });
  }

  async getAccountById(
    id: string,
    companyId: string
  ): Promise<(BankAccount & { account: Account }) | null> {
    return prisma.bankAccount.findFirst({
      where: { id, companyId },
      include: { account: true },
    });
  }

  async getAccountByGlAccountId(
    accountId: string,
    companyId: string
  ): Promise<(BankAccount & { account: Account }) | null> {
    return prisma.bankAccount.findUnique({
      where: {
        companyId_accountId: {
          companyId,
          accountId,
        },
      },
      include: { account: true },
    });
  }

  async listAccounts(
    companyId: string
  ): Promise<(BankAccount & { account: Account })[]> {
    return prisma.bankAccount.findMany({
      where: { companyId, isArchived: false },
      include: { account: true },
      orderBy: { account: { code: 'asc' } },
    });
  }

  // ============================================
  // Cash Transaction
  // ============================================

  async createTransaction(
    data: Prisma.CashTransactionUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<CashTransactionWithRelations> {
    const client = tx || prisma;
    return client.cashTransaction.create({
      data,
      include: {
        items: { include: { account: true } },
        sourceBank: { include: { account: true } },
        destinationBank: { include: { account: true } },
      },
    }) as Promise<CashTransactionWithRelations>;
  }

  async updateTransaction(
    id: string,
    companyId: string,
    data: Prisma.CashTransactionUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<CashTransactionWithRelations> {
    const client = tx || prisma;
    return client.cashTransaction.update({
      where: { id, companyId },
      data,
      include: {
        items: { include: { account: true } },
        sourceBank: { include: { account: true } },
        destinationBank: { include: { account: true } },
      },
    }) as Promise<CashTransactionWithRelations>;
  }

  async getTransactionById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<CashTransactionWithRelations | null> {
    const client = tx || prisma;
    return client.cashTransaction.findFirst({
      where: { id, companyId },
      include: {
        items: { include: { account: true } },
        sourceBank: { include: { account: true } },
        destinationBank: { include: { account: true } },
        journalEntry: { include: { lines: true } },
      },
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
    const where: Prisma.CashTransactionWhereInput = {
      companyId,
      status: params.status,
    };

    if (params.bankAccountId) {
      where.OR = [
        { sourceBankAccountId: params.bankAccountId },
        { destinationBankAccountId: params.bankAccountId },
      ];
    }

    if (params.startDate || params.endDate) {
      where.date = {};
      if (params.startDate) where.date.gte = params.startDate;
      if (params.endDate) where.date.lte = params.endDate;
    }

    const transactions = await prisma.cashTransaction.findMany({
      where,
      include: {
        items: { include: { account: true } },
        sourceBank: { include: { account: true } },
        destinationBank: { include: { account: true } },
      },
      orderBy: { date: 'desc' },
    });

    return transactions as CashTransactionWithRelations[];
  }

  async getTransactionByJournalId(
    journalId: string
  ): Promise<CashTransaction | null> {
    return prisma.cashTransaction.findUnique({
      where: { journalEntryId: journalId },
    });
  }
}
