import { useMemo } from 'react';
import {
  AccountType,
  AccountGroup,
  RouterOutputs,
} from '@/types/api';
import { AccountTypeSchema } from '@sync-erp/shared';
import { ReportSection } from '@/features/accounting/components/FinancialReport';

type TrialBalance = RouterOutputs['finance']['getTrialBalance'];

// Helper to check account type category
const isDebitNormal = (type: string) =>
  (
    [
      AccountTypeSchema.enum.ASSET,
      AccountTypeSchema.enum.EXPENSE,
    ] as string[]
  ).includes(type);

export function useFinancialReports(
  trialBalance: TrialBalance | undefined
) {
  return useMemo(() => {
    if (!trialBalance) return null;

    const entries = trialBalance.entries;

    // Helper to build AccountGroup
    const buildGroup = (type: AccountType): AccountGroup => {
      const groupEntries = entries.filter(
        (e) => e.accountType === type
      );
      const accs = groupEntries
        .map((e) => ({
          id: e.accountId,
          code: e.accountCode,
          name: e.accountName,
          type: e.accountType as AccountType,
          // Calculate balance based on normal side
          balance: isDebitNormal(e.accountType)
            ? Number(e.debit) - Number(e.credit)
            : Number(e.credit) - Number(e.debit),
          isActive: true,
          companyId: '',
        }))
        .filter((a) => Math.abs(a.balance) > 0.01); // Filter zero balance for report clarity

      const total = accs.reduce((sum, a) => sum + a.balance, 0);

      return {
        type,
        accounts: accs,
        total,
      };
    };

    // 1. Income Statement
    const revenueGroup = buildGroup(AccountTypeSchema.enum.REVENUE);
    const expenseGroup = buildGroup(AccountTypeSchema.enum.EXPENSE);
    const netIncome = revenueGroup.total - expenseGroup.total;

    const incomeStatement: {
      sections: ReportSection[];
      netIncome: number;
    } = {
      sections: [
        {
          title: 'Revenue',
          groups: [revenueGroup],
          totalLabel: 'Total Revenue',
          totalValue: revenueGroup.total,
        },
        {
          title: 'Expenses',
          groups: [expenseGroup],
          totalLabel: 'Total Expenses',
          totalValue: expenseGroup.total,
        },
      ],
      netIncome,
    };

    // 2. Balance Sheet
    const assetGroup = buildGroup(AccountTypeSchema.enum.ASSET);
    const liabilityGroup = buildGroup(
      AccountTypeSchema.enum.LIABILITY
    );
    const equityGroup = buildGroup(AccountTypeSchema.enum.EQUITY);

    // Add Net Income to Equity
    const retainedEarnings = {
      id: 'retained-earnings',
      code: '3999',
      name: 'Current Year Earnings',
      type: AccountTypeSchema.enum.EQUITY,
      balance: netIncome,
      isActive: true,
      companyId: '',
    };

    // Create a new Equity group including Retained Earnings
    const equityAccountsWithRE = [
      ...equityGroup.accounts,
      retainedEarnings,
    ];
    const totalEquity = equityGroup.total + netIncome;

    const augmentedEquityGroup: AccountGroup = {
      type: AccountTypeSchema.enum.EQUITY,
      accounts: equityAccountsWithRE,
      total: totalEquity,
    };

    const totalAssets = assetGroup.total;
    const totalLiabilitiesAndEquity =
      liabilityGroup.total + totalEquity;
    const isBalanced =
      Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1;

    const balanceSheet = {
      sections: [
        {
          title: 'Assets',
          groups: [assetGroup],
          totalLabel: 'Total Assets',
          totalValue: totalAssets,
        },
        {
          title: 'Liabilities',
          groups: [liabilityGroup],
          totalLabel: 'Total Liabilities',
          totalValue: liabilityGroup.total,
        },
        {
          title: 'Equity',
          groups: [augmentedEquityGroup],
          totalLabel: 'Total Equity',
          totalValue: totalEquity,
        },
      ],
      grandTotalLabel: 'Total Liabilities & Equity',
      grandTotalValue: totalLiabilitiesAndEquity,
      isBalanced,
    };

    return { incomeStatement, balanceSheet };
  }, [trialBalance]);
}
