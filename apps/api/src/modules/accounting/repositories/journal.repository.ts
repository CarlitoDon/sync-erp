import { prisma, JournalEntry, Prisma, AccountType } from '@sync-erp/database';

export class JournalRepository {
  async create(data: Prisma.JournalEntryUncheckedCreateInput): Promise<JournalEntry> {
    return prisma.journalEntry.create({
      data,
      include: {
        lines: { include: { account: true } },
      },
    });
  }

  async findById(id: string, companyId: string): Promise<JournalEntry | null> {
    return prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        lines: { include: { account: true } },
      },
    });
  }

  async findAll(companyId: string, startDate?: Date, endDate?: Date): Promise<JournalEntry[]> {
    return prisma.journalEntry.findMany({
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

  async aggregateAccountSum(accountId: string, dateLimit?: Date) {
    return prisma.journalLine.aggregate({
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

  async aggregateAccountSumRange(accountId: string, startDate?: Date) {
    return prisma.journalLine.aggregate({
      where: {
        accountId,
        journal: {
          ...(startDate && { date: { gte: startDate } }), // wait, if startDate only?
          // Logic: if start and end provided.
          // actually this is for opening balance (lt startDate)
        },
      },
      _sum: { debit: true, credit: true },
    });
  }

  // Specific method for Opening Balance (before startDate)
  async getOpeningBalanceSum(accountId: string, startDate: Date) {
    return prisma.journalLine.aggregate({
      where: {
        accountId,
        journal: { date: { lt: startDate } },
      },
      _sum: { debit: true, credit: true },
    });
  }

  async findLinesByAccount(companyId: string, accountId: string, startDate?: Date, endDate?: Date) {
    return prisma.journalLine.findMany({
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

  async aggregateTypeSum(companyId: string, type: AccountType, startDate: Date, endDate: Date) {
    return prisma.journalLine.aggregate({
      where: {
        account: { companyId, type },
        journal: { date: { gte: startDate, lte: endDate } },
      },
      _sum: { debit: true, credit: true },
    });
  }
}
