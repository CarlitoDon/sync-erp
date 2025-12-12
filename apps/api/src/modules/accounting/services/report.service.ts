import { AccountType } from '@sync-erp/database';
import { AccountRepository } from '../repositories/account.repository';
import { JournalRepository } from '../repositories/journal.repository';

export interface TrialBalanceEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceSummary {
  entries: TrialBalanceEntry[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface GeneralLedgerEntry {
  date: Date;
  reference: string | null;
  memo: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export interface GeneralLedgerReport {
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
  private accountRepository = new AccountRepository();
  private journalRepository = new JournalRepository();

  async getTrialBalance(
    companyId: string,
    asOfDate?: Date
  ): Promise<TrialBalanceSummary> {
    const dateFilter = asOfDate || new Date();
    const accounts = await this.accountRepository.findAll(companyId);

    const entries: TrialBalanceEntry[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const account of accounts) {
      const sums = await this.journalRepository.aggregateAccountSum(
        account.id,
        dateFilter
      );
      const debit = Number(sums._sum.debit || 0);
      const credit = Number(sums._sum.credit || 0);

      let balance: number;
      if (
        account.type === AccountType.ASSET ||
        account.type === AccountType.EXPENSE
      ) {
        balance = debit - credit;
      } else {
        balance = credit - debit;
      }

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

  async getGeneralLedger(
    companyId: string,
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<GeneralLedgerReport> {
    const account = await this.accountRepository.findById(
      accountId,
      companyId
    );
    if (!account) {
      throw new Error('Account not found');
    }

    let openingBalance = 0;
    if (startDate) {
      const openingSums =
        await this.journalRepository.getOpeningBalanceSum(
          accountId,
          startDate
        );
      const openingDebit = Number(openingSums._sum.debit || 0);
      const openingCredit = Number(openingSums._sum.credit || 0);
      openingBalance =
        account.type === AccountType.ASSET ||
        account.type === AccountType.EXPENSE
          ? openingDebit - openingCredit
          : openingCredit - openingDebit;
    }

    const journalLines =
      await this.journalRepository.findLinesByAccount(
        companyId,
        accountId,
        startDate,
        endDate
      );

    let runningBalance = openingBalance;
    const entries: GeneralLedgerEntry[] = journalLines.map((line) => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);

      if (
        account.type === AccountType.ASSET ||
        account.type === AccountType.EXPENSE
      ) {
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

  async getIncomeStatement(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    revenue: number;
    expenses: number;
    netIncome: number;
  }> {
    const revenueSums = await this.journalRepository.aggregateTypeSum(
      companyId,
      AccountType.REVENUE,
      startDate,
      endDate
    );
    const revenue =
      Number(revenueSums._sum.credit || 0) -
      Number(revenueSums._sum.debit || 0);

    const expenseSums = await this.journalRepository.aggregateTypeSum(
      companyId,
      AccountType.EXPENSE,
      startDate,
      endDate
    );
    const expenses =
      Number(expenseSums._sum.debit || 0) -
      Number(expenseSums._sum.credit || 0);

    return {
      revenue,
      expenses,
      netIncome: revenue - expenses,
    };
  }
}
