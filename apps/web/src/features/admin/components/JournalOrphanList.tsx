import { useCompanyData } from '@/hooks/useCompanyData';
import {
  adminService,
  type OrphanJournal,
} from '@/features/admin/services/admin.service';
import { formatCurrency } from '@/utils/format';

const defaultOrphans: OrphanJournal[] = [];

/**
 * JournalOrphanList component - displays orphan journal entries.
 * Part of Phase 1 Admin Observability (US5).
 *
 * Per FR-016: Displays journal entries with missing/invalid source references.
 */
export function JournalOrphanList() {
  const {
    data: result,
    loading,
    error,
  } = useCompanyData(async () => {
    const response = await adminService.getOrphanJournals();
    return response.data;
  }, defaultOrphans);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Failed to load orphan journals</p>
      </div>
    );
  }

  if (result.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-700 font-medium">
          No orphan journals found
        </p>
        <p className="text-green-600 text-sm mt-1">
          All journals have valid source references
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Source Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Source ID
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Memo
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {result.map((journal) => {
            const totalDebit = journal.lines.reduce(
              (sum, l) => sum + Number(l.debit),
              0
            );
            const totalCredit = journal.lines.reduce(
              (sum, l) => sum + Number(l.credit),
              0
            );

            return (
              <tr key={journal.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  {new Date(journal.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  {journal.sourceType || (
                    <span className="text-yellow-600 font-medium">
                      MISSING
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-sm text-gray-500">
                  {journal.sourceId?.slice(0, 8) || (
                    <span className="text-yellow-600 font-medium">
                      MISSING
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                  {journal.memo || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <span className="text-green-600">
                    {formatCurrency(totalDebit)}
                  </span>
                  {' / '}
                  <span className="text-red-600">
                    {formatCurrency(totalCredit)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
