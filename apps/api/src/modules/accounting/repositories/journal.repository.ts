import { prisma, Prisma, AccountType } from '@sync-erp/database';

export class JournalRepository {
  async create(
    data: Prisma.JournalEntryUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    try {
      return await db.journalEntry.create({
        data,
        include: {
          lines: { include: { account: true } },
        },
      });
    } catch (err) {
      // Handle unique constraint violation (P2002)
      if (
        (err as Prisma.PrismaClientKnownRequestError).code === 'P2002'
      ) {
        const sourceType = data.sourceType || 'UNKNOWN';
        const sourceId = data.sourceId || 'UNKNOWN';
        console.warn(
          `[JOURNAL] Duplicate journal entry blocked: ${sourceType}:${sourceId}`
        );
        throw new Error(
          `Journal entry already exists for ${sourceType} ${sourceId}`
        );
      }
      throw err;
    }
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        lines: { include: { account: true } },
      },
    });
  }

  async findAll(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.journalEntry.findMany({
      where: {
        companyId,
        ...(startDate && { date: { gte: startDate } }),
        ...(endDate && { date: { lte: endDate } }),
      },
      include: {
        lines: { include: { account: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async aggregateAccountSum(
    accountId: string,
    dateLimit?: Date,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.journalLine.aggregate({
      where: {
        accountId,
        ...(dateLimit && { journal: { date: { lte: dateLimit } } }),
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });
  }

  async aggregateAccountSumRange(
    accountId: string,
    startDate?: Date,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.journalLine.aggregate({
      where: {
        accountId,
        journal: {
          ...(startDate && { date: { gte: startDate } }),
        },
      },
      _sum: { debit: true, credit: true },
    });
  }

  // Specific method for Opening Balance (before startDate)
  async getOpeningBalanceSum(
    accountId: string,
    startDate: Date,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.journalLine.aggregate({
      where: {
        accountId,
        journal: { date: { lt: startDate } },
      },
      _sum: { debit: true, credit: true },
    });
  }

  async findLinesByAccount(
    companyId: string,
    accountId: string,
    startDate?: Date,
    endDate?: Date,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.journalLine.findMany({
      where: {
        accountId,
        journal: {
          companyId,
          ...(startDate && { date: { gte: startDate } }),
          ...(endDate && { date: { lte: endDate } }),
        },
      },
      include: { journal: true },
      orderBy: { journal: { date: 'asc' } },
    });
  }

  async aggregateTypeSum(
    companyId: string,
    type: AccountType,
    startDate: Date,
    endDate: Date,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.journalLine.aggregate({
      where: {
        account: { companyId, type },
        journal: { date: { gte: startDate, lte: endDate } },
      },
      _sum: { debit: true, credit: true },
    });
  }
}
