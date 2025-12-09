import { prisma, AccountType } from '@sync-erp/database';

interface TrialBalanceEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
  balance: number;
}

interface TrialBalanceSummary {
  entries: TrialBalanceEntry[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

interface GeneralLedgerEntry {
  date: Date;
  reference: string | null;
  memo: string | null;
  debit: number;
  credit: number;
  balance: number;
}

interface GeneralLedgerReport {
  account: {
    id: string;
    code: string;
    name: string;
    type: AccountType;
  };
  entries: GeneralLedgerEntry[];
  openingBalance: number;
  closingBalance: number;
}

export class ReportService {
  /**
   * Generate Trial Balance
   */
  async getTrialBalance(companyId: string, asOfDate?: Date): Promise<TrialBalanceSummary> {
    const dateFilter = asOfDate || new Date();

    // Get all accounts with their journal line sums
    const accounts = await prisma.account.findMany({
      where: { companyId, isActive: true },
      orderBy: { code: 'asc' },
    });

    const entries: TrialBalanceEntry[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const account of accounts) {
      // Sum all debits and credits for this account up to asOfDate
      const sums = await prisma.journalLine.aggregate({
        where: {
          accountId: account.id,
          journal: {
            date: { lte: dateFilter },
          },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const debit = Number(sums._sum.debit || 0);
      const credit = Number(sums._sum.credit || 0);

      // Calculate balance based on account type
      // Assets & Expenses: Normal debit balance (debit - credit)
      // Liabilities, Equity, Revenue: Normal credit balance (credit - debit)
      let balance: number;
      if (account.type === AccountType.ASSET || account.type === AccountType.EXPENSE) {
        balance = debit - credit;
      } else {
        balance = credit - debit;
      }

      // Only include accounts with activity
      if (debit > 0 || credit > 0) {
        entries.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          debit,
          credit,
          balance,
        });

        totalDebit += debit;
        totalCredit += credit;
      }
    }

    return {
      entries,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }

  /**
   * Generate General Ledger for a specific account
   */
  async getGeneralLedger(
    companyId: string,
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<GeneralLedgerReport> {
    const account = await prisma.account.findFirst({
      where: { id: accountId, companyId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // Get opening balance (sum before startDate)
    let openingBalance = 0;
    if (startDate) {
      const openingSums = await prisma.journalLine.aggregate({
        where: {
          accountId,
          journal: {
            date: { lt: startDate },
          },
        },
        _sum: { debit: true, credit: true },
      });
      const openingDebit = Number(openingSums._sum.debit || 0);
      const openingCredit = Number(openingSums._sum.credit || 0);
      openingBalance =
        account.type === AccountType.ASSET || account.type === AccountType.EXPENSE
          ? openingDebit - openingCredit
          : openingCredit - openingDebit;
    }

    // Get journal entries in date range
    const journalLines = await prisma.journalLine.findMany({
      where: {
        accountId,
        journal: {
          companyId,
          ...(startDate && { date: { gte: startDate } }),
          ...(endDate && { date: { lte: endDate } }),
        },
      },
      include: {
        journal: true,
      },
      orderBy: { journal: { date: 'asc' } },
    });

    let runningBalance = openingBalance;
    const entries: GeneralLedgerEntry[] = journalLines.map((line) => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);

      if (account.type === AccountType.ASSET || account.type === AccountType.EXPENSE) {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }

      return {
        date: line.journal.date,
        reference: line.journal.reference,
        memo: line.journal.memo,
        debit,
        credit,
        balance: runningBalance,
      };
    });

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
      },
      entries,
      openingBalance,
      closingBalance: runningBalance,
    };
  }

  /**
   * Get profit/loss summary
   */
  async getIncomeStatement(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    revenue: number;
    expenses: number;
    netIncome: number;
  }> {
    // Sum revenue accounts
    const revenueSums = await prisma.journalLine.aggregate({
      where: {
        account: { companyId, type: AccountType.REVENUE },
        journal: { date: { gte: startDate, lte: endDate } },
      },
      _sum: { credit: true, debit: true },
    });
    const revenue = Number(revenueSums._sum.credit || 0) - Number(revenueSums._sum.debit || 0);

    // Sum expense accounts
    const expenseSums = await prisma.journalLine.aggregate({
      where: {
        account: { companyId, type: AccountType.EXPENSE },
        journal: { date: { gte: startDate, lte: endDate } },
      },
      _sum: { debit: true, credit: true },
    });
    const expenses = Number(expenseSums._sum.debit || 0) - Number(expenseSums._sum.credit || 0);

    return {
      revenue,
      expenses,
      netIncome: revenue - expenses,
    };
  }
}
