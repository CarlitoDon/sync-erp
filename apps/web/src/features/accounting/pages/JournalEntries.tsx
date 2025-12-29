import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { formatCurrency, formatDate } from '@/utils/format';
import ActionButton from '@/components/ui/ActionButton';
import FormModal from '@/components/ui/FormModal';
import { CurrencyInput } from '@/components/ui';
import { toast } from 'react-hot-toast';
import Select from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';

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

export default function JournalEntries() {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  const { data: journals = [], isLoading: loadingJournals } =
    trpc.finance.listJournals.useQuery(undefined, {
      enabled: !!currentCompany?.id,
    });

  const { data: accounts = [] } = trpc.finance.listAccounts.useQuery(
    undefined,
    {
      enabled: !!currentCompany?.id,
    }
  );

  const createMutation = trpc.finance.createJournal.useMutation({
    onSuccess: () => {
      utils.finance.listJournals.invalidate();
      utils.finance.getTrialBalance.invalidate(); // Impacts reports
      utils.finance.getGeneralLedger.invalidate();
    },
  });

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

  const handleSubmitJournal = async () => {
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
      toast.error(
        `Entry is unbalanced. Debit: ${totalDebit}, Credit: ${totalCredit}`
      );
      return;
    }

    if (formData.lines.some((l) => !l.accountId)) {
      toast.error('All lines must have an account selected.');
      return;
    }

    await apiAction(
      () =>
        createMutation.mutateAsync({
          date: new Date(formData.date!),
          reference: formData.reference,
          memo: formData.memo,
          lines: formData.lines as CreateJournalLineInput[],
        }),
      'Journal entry posted successfully'
    );

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
  };

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

  if (loadingJournals && journals.length === 0) {
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
      <Card>
        <CardContent className="p-0">
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
                  const total = journal.lines.reduce<number>(
                    (sum, l) => sum + Number(l.debit),
                    0
                  );
                  return (
                    <tr key={journal.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(journal.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <Link
                          to={`/journals/${journal.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {journal.reference || 'View Entry'}
                        </Link>
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
        </CardContent>
      </Card>

      {/* Modal */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="New Journal Entry"
        maxWidth="4xl"
      >
        <div className="space-y-6">
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
              <div className="col-span-2 text-right">Credit</div>
              <div className="col-span-2 text-center">Action</div>
            </div>

            {formData.lines?.map(
              (line: CreateJournalLineInput, idx: number) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center"
                >
                  <div className="col-span-6">
                    <Select
                      value={line.accountId}
                      onChange={(val) =>
                        handleLineChange(idx, 'accountId', val)
                      }
                      options={accounts.map((acc) => ({
                        value: acc.id,
                        label: `${acc.code} - ${acc.name}`,
                      }))}
                      placeholder="Select Account..."
                    />
                  </div>
                  <div className="col-span-2">
                    <CurrencyInput
                      value={line.debit}
                      onChange={(val) =>
                        handleLineChange(idx, 'debit', val)
                      }
                      min={0}
                      prefix=""
                      disabled={line.credit > 0}
                    />
                  </div>
                  <div className="col-span-2">
                    <CurrencyInput
                      value={line.credit}
                      onChange={(val) =>
                        handleLineChange(idx, 'credit', val)
                      }
                      min={0}
                      prefix=""
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
              <div className="col-span-6 text-right pr-4">Total</div>
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
                {formatCurrency(Math.abs(totalDebit - totalCredit))}{' '}
                difference
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitJournal}
              disabled={
                !isBalanced ||
                createMutation.isPending ||
                (formData.lines?.some((l) => !l.accountId) ?? true)
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Posting...' : 'Post Entry'}
            </button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
