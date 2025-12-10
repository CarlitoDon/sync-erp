import { useState } from 'react';
import { financeService, Account, TrialBalance } from '../services/financeService';
import { useCompany } from '../contexts/CompanyContext';
import { useCompanyData } from '../hooks/useCompanyData';
import { apiAction } from '../hooks/useApiAction';

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
    {
      accounts: [],
      trialBalance: null,
    }
  );

  const [activeTab, setActiveTab] = useState<'coa' | 'trial-balance'>('coa');
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    type: 'ASSET' as Account['type'],
  });

  const handleSeedAccounts = async () => {
    const seeded = await apiAction(
      () => financeService.seedDefaultAccounts(),
      'Default accounts seeded!'
    );
    if (seeded) loadData();
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await apiAction(
      () => financeService.createAccount(newAccount),
      'Account created!'
    );
    if (result) {
      setShowCreateAccount(false);
      setNewAccount({ code: '', name: '', type: 'ASSET' });
      loadData();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value);
  };

  const getTypeColor = (type: Account['type']) => {
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

  const groupedAccounts = {
    ASSET: accounts.filter((a) => a.type === 'ASSET'),
    LIABILITY: accounts.filter((a) => a.type === 'LIABILITY'),
    EQUITY: accounts.filter((a) => a.type === 'EQUITY'),
    REVENUE: accounts.filter((a) => a.type === 'REVENUE'),
    EXPENSE: accounts.filter((a) => a.type === 'EXPENSE'),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Please select a company to view financial reports.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="text-gray-500">
            Chart of Accounts & Financial Reports for {currentCompany.name}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('coa')}
            className={`py-4 px-1 font-medium text-sm border-b-2 ${
              activeTab === 'coa'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Chart of Accounts
          </button>
          <button
            onClick={() => setActiveTab('trial-balance')}
            className={`py-4 px-1 font-medium text-sm border-b-2 ${
              activeTab === 'trial-balance'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Trial Balance
          </button>
        </nav>
      </div>

      {/* Chart of Accounts */}
      {activeTab === 'coa' && (
        <div className="space-y-6">
          <div className="flex gap-4">
            <button
              onClick={() => setShowCreateAccount(!showCreateAccount)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              {showCreateAccount ? 'Cancel' : '+ Add Account'}
            </button>
            {accounts.length === 0 && (
              <button
                onClick={handleSeedAccounts}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Seed Default CoA
              </button>
            )}
          </div>

          {showCreateAccount && (
            <form
              onSubmit={handleCreateAccount}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <h3 className="text-lg font-semibold mb-4">New Account</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={newAccount.code}
                    onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., 1100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Account name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={newAccount.type}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, type: e.target.value as Account['type'] })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="ASSET">Asset</option>
                    <option value="LIABILITY">Liability</option>
                    <option value="EQUITY">Equity</option>
                    <option value="REVENUE">Revenue</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Create Account
              </button>
            </form>
          )}

          {/* Account Groups */}
          <div className="grid gap-6">
            {Object.entries(groupedAccounts).map(([type, accs]) => (
              <div key={type} className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${getTypeColor(type as Account['type'])}`}
                    >
                      {type}
                    </span>
                    <span className="text-gray-500 text-sm font-normal">
                      ({accs.length} accounts)
                    </span>
                  </h3>
                </div>
                {accs.length > 0 ? (
                  <ul className="divide-y divide-gray-100">
                    {accs.map((acc) => (
                      <li key={acc.id} className="px-6 py-3 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-sm text-gray-500 mr-3">{acc.code}</span>
                          <span className="font-medium">{acc.name}</span>
                        </div>
                        {!acc.isActive && <span className="text-xs text-gray-400">Inactive</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-6 py-4 text-gray-400 text-sm">No accounts</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trial Balance */}
      {activeTab === 'trial-balance' && trialBalance && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-lg">Trial Balance</h3>
            <span
              className={`px-3 py-1 text-sm rounded-full ${
                trialBalance.isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {trialBalance.isBalanced ? '✓ Balanced' : '✗ Unbalanced'}
            </span>
          </div>

          {trialBalance.entries.length > 0 ? (
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Account
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Debit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trialBalance.entries.map((entry) => (
                  <tr key={entry.accountId}>
                    <td className="px-6 py-3 font-mono text-sm">{entry.accountCode}</td>
                    <td className="px-6 py-3 font-medium">{entry.accountName}</td>
                    <td className="px-6 py-3 text-center">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getTypeColor(entry.accountType)}`}
                      >
                        {entry.accountType}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={3} className="px-6 py-3 text-right">
                    Total
                  </td>
                  <td className="px-6 py-3 text-right">
                    {formatCurrency(trialBalance.totalDebit)}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {formatCurrency(trialBalance.totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="px-6 py-12 text-center text-gray-500">
              No journal entries yet. Create transactions to see the trial balance.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
