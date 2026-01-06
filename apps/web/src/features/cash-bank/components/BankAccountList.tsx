import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { formatCurrency } from '@/utils/format';
import { LoadingState } from '@/components/ui';
import {
  PlusIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import BankAccountForm from './BankAccountForm';

export default function BankAccountList() {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<
    string | undefined
  >();

  const { data: accounts = [], isLoading: loading } =
    trpc.cashBank.listAccounts.useQuery(undefined, {
      enabled: !!currentCompany?.id,
    });

  const handleEdit = (id: string) => {
    setSelectedAccountId(id);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setSelectedAccountId(undefined);
    setIsFormOpen(true);
  };

  const handleSuccess = () => {
    utils.cashBank.listAccounts.invalidate();
  };

  if (loading && accounts.length === 0) {
    return <LoadingState size="md" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">
          Bank & Cash Accounts
        </h2>
        <Button
          onClick={handleAdd}
          size="sm"
          className="flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Add Account
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Account Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                GL Account
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Account Number
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Balance
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {accounts.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No bank accounts configured.
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {account.bankName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {account.currency}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded inline-block">
                      {account.account?.code}
                    </div>
                    <span className="ml-2 text-sm text-gray-600">
                      {account.account?.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {account.accountNumber || '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`text-sm font-semibold ${
                        (account.balance || 0) < 0
                          ? 'text-red-600'
                          : 'text-gray-900'
                      }`}
                    >
                      {formatCurrency(Number(account.balance || 0))}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(account.id)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <PencilSquareIcon className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <BankAccountForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        accountId={selectedAccountId}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
