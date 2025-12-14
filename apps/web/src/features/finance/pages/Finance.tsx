import { useState, useMemo } from 'react';
import {
  financeService,
  Account,
  TrialBalance,
} from '../services/financeService';
import { useCompany } from '../../../contexts/CompanyContext';
import { useCompanyData } from '../../../hooks/useCompanyData';
import { apiAction } from '../../../hooks/useApiAction';
import {
  FinancialReport,
  ReportSection,
} from '../components/FinancialReport';
import JournalEntries from './JournalEntries';
import { AccountGroup, AccountType } from '@sync-erp/shared';
import FormModal from '../../../components/ui/FormModal';

// Helper to check account type category
const isDebitNormal = (type: string) =>
  ['ASSET', 'EXPENSE'].includes(type);

interface FinanceData {
  accounts: Account[];
  trialBalance: TrialBalance | null;
}

export default function Finance() {
  const { currentCompany } = useCompany();

  const {
    data: { accounts, trialBalance },
    loading,
    refresh: loadData,
  } = useCompanyData<FinanceData>(
    async () => {
      const [accountsData, tbData] = await Promise.all([
        financeService.listAccounts(),
        financeService.getTrialBalance(),
      ]);
      return {
        accounts: accountsData,
        trialBalance: tbData,
      };
    },
    { accounts: [], trialBalance: null }
  );

  const [activeTab, setActiveTab] = useState<
    'overview' | 'reports' | 'journals'
  >('overview');
  const [reportType, setReportType] = useState<'IS' | 'BS'>('BS');

  // Create Account State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    type: 'ASSET' as Account['type'],
  });

  const handleSeedAccounts = async () => {
    await apiAction(
      () => financeService.seedDefaultAccounts(),
      'Default accounts seeded!'
    );
    loadData();
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await apiAction(
      () => financeService.createAccount(newAccount),
      'Account created!'
    );
    if (result) {
      setIsAccountModalOpen(false);
      setNewAccount({ code: '', name: '', type: 'ASSET' });
      loadData();
    }
  };

  const handleCloseAccountModal = () => {
    setIsAccountModalOpen(false);
    setNewAccount({ code: '', name: '', type: 'ASSET' });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ASSET':
        return 'bg-blue-100 text-blue-800';
      case 'LIABILITY':
        return 'bg-red-100 text-red-800';
      case 'EQUITY':
        return 'bg-purple-100 text-purple-800';
      case 'REVENUE':
        return 'bg-green-100 text-green-800';
      case 'EXPENSE':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // --- Report Aggregation Logic ---
  const reportsData = useMemo(() => {
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
    const revenueGroup = buildGroup('REVENUE');
    const expenseGroup = buildGroup('EXPENSE');
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
    const assetGroup = buildGroup('ASSET');
    const liabilityGroup = buildGroup('LIABILITY');
    const equityGroup = buildGroup('EQUITY');

    // Add Net Income to Equity
    const retainedEarnings = {
      id: 'retained-earnings',
      code: '3999',
      name: 'Current Year Earnings',
      type: 'EQUITY',
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
      type: 'EQUITY',
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

  if (loading && !accounts.length) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading finance data...
      </div>
    );
  }

  if (!currentCompany) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Finance
          </h1>
          <p className="text-gray-500">
            Financial Management & Reporting
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview & CoA' },
            { id: 'reports', label: 'Financial Reports' },
            { id: 'journals', label: 'Journal Entries' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setActiveTab(
                  tab.id as 'overview' | 'reports' | 'journals'
                )
              }
              className={`py-4 px-1 font-medium text-sm border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB CONTENT */}

      {/* 1. OVERVIEW (CoA) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* CoA Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
            >
              + Add Account
            </button>
            {accounts.length === 0 && (
              <button
                onClick={handleSeedAccounts}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
              >
                Seed Default Accounts
              </button>
            )}
          </div>

          {/* New Account Modal */}
          <FormModal
            isOpen={isAccountModalOpen}
            onClose={handleCloseAccountModal}
            title="New Account"
            maxWidth="md"
          >
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    required
                    value={newAccount.code}
                    onChange={(e) =>
                      setNewAccount({
                        ...newAccount,
                        code: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., 1100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newAccount.name}
                    onChange={(e) =>
                      setNewAccount({
                        ...newAccount,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Account name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={newAccount.type}
                    onChange={(e) =>
                      setNewAccount({
                        ...newAccount,
                        type: e.target.value as Account['type'],
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {[
                      'ASSET',
                      'LIABILITY',
                      'EQUITY',
                      'REVENUE',
                      'EXPENSE',
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseAccountModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </FormModal>


          {/* CoA List by Type */}
          <div className="grid gap-6">
            {[
              'ASSET',
              'LIABILITY',
              'EQUITY',
              'REVENUE',
              'EXPENSE',
            ].map((type) => {
              const typeAccounts = accounts.filter(
                (a) => a.type === type
              );
              return (
                <div
                  key={type}
                  className="bg-white rounded-xl shadow-sm border border-gray-200"
                >
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getTypeColor(type)}`}
                      >
                        {type}
                      </span>
                      <span className="text-gray-500 text-sm font-normal">
                        ({typeAccounts.length})
                      </span>
                    </h3>
                  </div>
                  {typeAccounts.length > 0 ? (
                    <ul className="divide-y divide-gray-100">
                      {typeAccounts.map((acc) => (
                        <li
                          key={acc.id}
                          className="px-6 py-3 flex items-center justify-between hover:bg-gray-50"
                        >
                          <div>
                            <span className="font-mono text-sm text-gray-500 mr-3 w-16 inline-block">
                              {acc.code}
                            </span>
                            <span className="font-medium">
                              {acc.name}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-6 py-4 text-gray-400 text-sm">
                      No accounts
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. REPORTS */}
      {activeTab === 'reports' && reportsData && (
        <div className="space-y-6">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setReportType('BS')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${reportType === 'BS' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Balance Sheet
            </button>
            <button
              onClick={() => setReportType('IS')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${reportType === 'IS' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Income Statement
            </button>
          </div>

          {reportType === 'BS' ? (
            <FinancialReport
              title="Balance Sheet"
              subtitle={`As of ${new Date().toLocaleDateString()}`}
              sections={reportsData.balanceSheet.sections}
              grandTotalLabel={
                reportsData.balanceSheet.grandTotalLabel
              }
              grandTotalValue={
                reportsData.balanceSheet.grandTotalValue
              }
              isBalanced={reportsData.balanceSheet.isBalanced}
            />
          ) : (
            <FinancialReport
              title="Income Statement"
              subtitle="Current Period"
              sections={reportsData.incomeStatement.sections}
              grandTotalLabel="Net Income"
              grandTotalValue={reportsData.incomeStatement.netIncome}
            />
          )}
        </div>
      )}

      {/* 3. JOURNAL ENTRIES */}
      {activeTab === 'journals' && <JournalEntries />}
    </div>
  );
}
