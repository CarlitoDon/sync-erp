import { useEffect, useState } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  financeService,
  JournalEntry,
  Account,
} from '../services/financeService';
// import { CreateJournalEntryInput, CreateJournalLineInput } from '@sync-erp/shared';
// Defining locally to avoid build issues
interface CreateJournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
}
interface CreateJournalEntryInput {
  date: string;
  reference?: string;
  memo?: string;
  lines: CreateJournalLineInput[];
}
import ActionButton from '../components/ActionButton';
import { useApiAction } from '../hooks/useApiAction';
import { formatDate, formatCurrency } from '../utils/format';
import { toast } from 'react-hot-toast';

export default function JournalEntries() {
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<
    Partial<CreateJournalEntryInput>
  >({
    date: new Date().toISOString().split('T')[0],
    reference: '',
    memo: '',
    lines: [
      { accountId: '', debit: 0, credit: 0 },
      { accountId: '', debit: 0, credit: 0 },
    ],
  });

  const { execute: loadData, loading: loadingData } = useApiAction(
    async () => {
      const [jParams, aParams] = await Promise.all([
        financeService.listJournals(),
        financeService.listAccounts(),
      ]);
      setJournals(jParams);
      setAccounts(aParams);
    }
  );

  const { execute: submitJournal, loading: submitting } =
    useApiAction(async () => {
      if (
        !formData.date ||
        !formData.lines ||
        formData.lines.length < 2
      )
        return;

      // Validate balance
      const totalDebit = formData.lines.reduce(
        (sum: number, l: CreateJournalLineInput) =>
          sum + (Number(l.debit) || 0),
        0
      );
      const totalCredit = formData.lines.reduce(
        (sum: number, l: CreateJournalLineInput) =>
          sum + (Number(l.credit) || 0),
        0
      );

      if (Math.abs(totalDebit - totalCredit) > 1) {
        // 1 unit tolerance
        throw new Error(
          `Entry is unbalanced. Debit: ${totalDebit}, Credit: ${totalCredit}`
        );
      }

      if (formData.lines.some((l) => !l.accountId)) {
        throw new Error('All lines must have an account selected.');
      }

      await financeService.createJournal({
        date: new Date(formData.date).toISOString().split('T')[0], // Ensure YYYY-MM-DD
        reference: formData.reference,
        memo: formData.memo,
        lines: formData.lines as CreateJournalLineInput[],
      });

      setIsModalOpen(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        reference: '',
        memo: '',
        lines: [
          { accountId: '', debit: 0, credit: 0 },
          { accountId: '', debit: 0, credit: 0 },
        ],
      });
      toast.success('Journal entry posted successfully');
      loadData();
    });

  useEffect(() => {
    loadData();
  }, []);

  const handleLineChange = (
    index: number,
    field: keyof CreateJournalLineInput,
    value: string | number
  ) => {
    const newLines = [...(formData.lines || [])];
    newLines[index] = { ...newLines[index], [field]: value };
    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [
        ...(formData.lines || []),
        { accountId: '', debit: 0, credit: 0 },
      ],
    });
  };

  const removeLine = (index: number) => {
    if ((formData.lines?.length || 0) <= 2) return;
    const newLines = [...(formData.lines || [])];
    newLines.splice(index, 1);
    setFormData({ ...formData, lines: newLines });
  };

  // Calculations
  const totalDebit =
    formData.lines?.reduce(
      (sum: number, l: CreateJournalLineInput) =>
        sum + (Number(l.debit) || 0),
      0
    ) || 0;
  const totalCredit =
    formData.lines?.reduce(
      (sum: number, l: CreateJournalLineInput) =>
        sum + (Number(l.credit) || 0),
      0
    ) || 0;
  const isBalanced = Math.abs(totalDebit - totalCredit) < 1;

  if (loadingData && journals.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading finance data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Journal Entries
          </h1>
          <p className="text-sm text-gray-500">
            Manage manual accounting adjustments
          </p>
        </div>
        <ActionButton
          variant="primary"
          onClick={() => setIsModalOpen(true)}
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          New Entry
        </ActionButton>
      </div>

      {/* List */}
      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reference
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Memo
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {journals.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No journal entries found.
                </td>
              </tr>
            ) : (
              journals.map((journal) => {
                // Calculate total amount (sum of debits)
                const total = journal.lines.reduce(
                  (sum: number, l: { debit: number }) =>
                    sum + Number(l.debit),
                  0
                );
                return (
                  <tr key={journal.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(journal.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {journal.reference || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">
                      {journal.memo || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          aria-labelledby="modal-title"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              aria-hidden="true"
              onClick={() => setIsModalOpen(false)}
            ></div>
            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3
                  className="text-lg leading-6 font-medium text-gray-900 mb-4"
                  id="modal-title"
                >
                  New Journal Entry
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          date: e.target.value,
                        })
                      }
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Reference
                    </label>
                    <input
                      type="text"
                      value={formData.reference}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reference: e.target.value,
                        })
                      }
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2"
                      placeholder="e.g. ADJ-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Memo
                    </label>
                    <input
                      type="text"
                      value={formData.memo}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          memo: e.target.value,
                        })
                      }
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2"
                      placeholder="Optional description"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    <div className="col-span-6">Account</div>
                    <div className="col-span-2 text-right">Debit</div>
                    <div className="col-span-2 text-right">
                      Credit
                    </div>
                    <div className="col-span-2 text-center">
                      Action
                    </div>
                  </div>

                  {formData.lines?.map(
                    (line: CreateJournalLineInput, idx: number) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center"
                      >
                        <div className="col-span-6">
                          <select
                            value={line.accountId}
                            onChange={(e) =>
                              handleLineChange(
                                idx,
                                'accountId',
                                e.target.value
                              )
                            }
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2"
                          >
                            <option value="">
                              Select Account...
                            </option>
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0"
                            value={line.debit}
                            onChange={(e) =>
                              handleLineChange(
                                idx,
                                'debit',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2 text-right"
                            disabled={line.credit > 0} // Standard practice: cannot be both
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0"
                            value={line.credit}
                            onChange={(e) =>
                              handleLineChange(
                                idx,
                                'credit',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2 text-right"
                            disabled={line.debit > 0}
                          />
                        </div>
                        <div className="col-span-2 text-center">
                          <button
                            onClick={() => removeLine(idx)}
                            className="text-red-500 hover:text-red-700 disabled:opacity-50"
                            disabled={formData.lines!.length <= 2}
                          >
                            <TrashIcon className="w-5 h-5 mx-auto" />
                          </button>
                        </div>
                      </div>
                    )
                  )}

                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={addLine}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
                    >
                      <PlusIcon className="w-4 h-4 mr-1" /> Add Line
                    </button>
                  </div>

                  {/* Totals */}
                  <div className="grid grid-cols-12 gap-2 pt-4 mt-4 border-t border-gray-100 font-bold">
                    <div className="col-span-6 text-right pr-4">
                      Total
                    </div>
                    <div className="col-span-2 text-right">
                      {formatCurrency(totalDebit)}
                    </div>
                    <div className="col-span-2 text-right">
                      {formatCurrency(totalCredit)}
                    </div>
                    <div className="col-span-2"></div>
                  </div>

                  {!isBalanced && (
                    <div className="text-red-600 text-sm font-medium text-right mt-2">
                      Unbalanced:{' '}
                      {formatCurrency(
                        Math.abs(totalDebit - totalCredit)
                      )}{' '}
                      difference
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <ActionButton
                  variant="primary"
                  onClick={submitJournal}
                  disabled={
                    !isBalanced ||
                    submitting ||
                    (formData.lines?.some((l) => !l.accountId) ??
                      true)
                  }
                  isLoading={submitting}
                >
                  Post Entry
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                  className="mr-3"
                >
                  Cancel
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
