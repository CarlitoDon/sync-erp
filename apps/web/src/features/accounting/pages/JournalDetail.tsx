import { useParams, Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import ActionButton from '@/components/ui/ActionButton';
import { formatCurrency, formatDate } from '@/utils/format';
import { BackButton } from '@/components/ui/BackButton';
import { PageContainer } from '@/components/layout/PageLayout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/Card';

// Source type display config
const SOURCE_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; path: string }
> = {
  INVOICE: {
    label: 'Invoice Posting',
    color: 'bg-blue-100 text-blue-800',
    path: '/invoices',
  },
  BILL: {
    label: 'Bill Posting',
    color: 'bg-orange-100 text-orange-800',
    path: '/bills',
  },
  PAYMENT: {
    label: 'Payment',
    color: 'bg-green-100 text-green-800',
    path: '/payments',
  },
  CREDIT_NOTE: {
    label: 'Credit Note',
    color: 'bg-purple-100 text-purple-800',
    path: '/credit-notes',
  },
  ADJUSTMENT: {
    label: 'Adjustment',
    color: 'bg-gray-100 text-gray-800',
    path: '',
  },
};

export default function JournalDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentCompany } = useCompany();

  const {
    data: journal,
    isLoading: loading,
    error,
  } = trpc.finance.getJournalById.useQuery(
    { id: id! },
    { enabled: !!id && !!currentCompany?.id }
  );

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

  // Get source type config
  const sourceConfig = journal.sourceType
    ? SOURCE_TYPE_CONFIG[journal.sourceType]
    : null;
  const sourceLink =
    sourceConfig && journal.sourceId
      ? `${sourceConfig.path}/${journal.sourceId}`
      : null;

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Journal Entry{' '}
              {journal.reference ? `#${journal.reference}` : ''}
            </h1>
            <p className="text-sm text-gray-500">
              {formatDate(journal.date)}
              {journal.memo && ` • ${journal.memo}`}
            </p>
          </div>
        </div>
        {sourceConfig && (
          <span
            className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${sourceConfig.color}`}
          >
            {sourceConfig.label}
          </span>
        )}
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Journal Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Reference</p>
              <p className="font-mono font-medium">
                {journal.reference || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-medium">
                {formatDate(journal.date)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(totalDebit)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Source Document</p>
              <p className="font-medium">
                {sourceLink ? (
                  <Link
                    to={sourceLink}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    View {sourceConfig?.label.replace(' Posting', '')}
                  </Link>
                ) : (
                  <span className="text-gray-400">Manual Entry</span>
                )}
              </p>
            </div>
          </div>
          {journal.memo && (
            <>
              <hr className="my-4" />
              <div>
                <p className="text-sm text-gray-500">Memo</p>
                <p className="text-gray-700">{journal.memo}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Journal Lines Table */}
      <Card>
        <CardHeader className="border-b border-gray-200">
          <CardTitle>Journal Lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="font-medium">
                      <span className="text-gray-500 font-mono">
                        {line.account?.code}
                      </span>{' '}
                      {line.account?.name}
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
              {totalDebit !== totalCredit && (
                <tr className="bg-red-50">
                  <td
                    colSpan={3}
                    className="px-6 py-2 text-sm text-red-600 text-center"
                  >
                    ⚠️ Imbalanced: Debit ≠ Credit
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
