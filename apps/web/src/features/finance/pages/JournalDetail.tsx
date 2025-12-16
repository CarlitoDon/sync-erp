import { useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useCompanyData } from '../../../hooks/useCompanyData';
import {
  financeService,
  JournalEntry,
} from '../services/financeService';
import ActionButton from '../../../components/ui/ActionButton';
import { formatCurrency, formatDate } from '../../../utils/format';

export default function JournalDetail() {
  const { id } = useParams<{ id: string }>();

  const fetchJournal = useCallback(async () => {
    if (!id) return null;
    return await financeService.getJournal(id);
  }, [id]);

  const {
    data: journal,
    loading,
    error,
    refresh,
  } = useCompanyData<JournalEntry | null>(fetchJournal, null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading && !journal) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || (!loading && !journal)) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">
          Journal Entry not found
        </h2>
        <ActionButton
          onClick={() => window.history.back()}
          variant="secondary"
          className="mt-4"
        >
          Go Back
        </ActionButton>
      </div>
    );
  }

  if (!journal) return null;

  const totalDebit = journal.lines.reduce(
    (sum, line) => sum + Number(line.debit),
    0
  );
  const totalCredit = journal.lines.reduce(
    (sum, line) => sum + Number(line.credit),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => window.history.back()}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeftIcon className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Journal Entry{' '}
            {journal.reference ? `#${journal.reference}` : ''}
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{formatDate(journal.date)}</span>
            {journal.memo && (
              <>
                <span>•</span>
                <span>{journal.memo}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Account
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Debit
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Credit
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {journal.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="font-medium">
                    {line.account?.code} - {line.account?.name}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-900 font-mono">
                  {Number(line.debit) > 0
                    ? formatCurrency(Number(line.debit))
                    : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-900 font-mono">
                  {Number(line.credit) > 0
                    ? formatCurrency(Number(line.credit))
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-bold">
            <tr>
              <td className="px-6 py-3 text-sm text-gray-900 text-right">
                Total
              </td>
              <td className="px-6 py-3 text-sm text-right text-gray-900 font-mono">
                {formatCurrency(totalDebit)}
              </td>
              <td className="px-6 py-3 text-sm text-right text-gray-900 font-mono">
                {formatCurrency(totalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
