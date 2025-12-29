import { Link, useNavigate } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/utils/format';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function ExpenseList() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();

  const { data: expenses = [], isLoading } =
    trpc.expense.list.useQuery(undefined, {
      enabled: !!currentCompany?.id,
    });

  return (
    <PageContainer>
      <PageHeader
        title="Expenses"
        description={`Manage operating expenses for ${currentCompany?.name}`}
        actions={
          <Button
            onClick={() => navigate('/expenses/new')}
            className="flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            New Expense
          </Button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Payee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {expenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-sm">
                  <Link
                    to={`/expenses/${expense.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {expense.invoiceNumber}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {formatDate(expense.createdAt)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {expense.partner?.name || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {/* Description logic: show first product description or item description */}
                  {expense.items?.[0]?.description || '-'}
                  {expense.items?.length > 1
                    ? ` (+${expense.items.length - 1} more)`
                    : ''}
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium">
                  {formatCurrency(Number(expense.amount))}
                </td>
                <td className="px-6 py-4 text-center">
                  <StatusBadge status={expense.status} />
                </td>
              </tr>
            ))}
            {expenses.length === 0 && !isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No expenses found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  Loading...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
