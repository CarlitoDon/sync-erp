import { useCompanyData } from '@/hooks/useCompanyData';
import {
  adminService,
  type SagaLog,
} from '@/features/admin/services/admin.service';

const defaultSagaLogs: SagaLog[] = [];

/**
 * SagaFailureList component - displays failed/compensated sagas.
 * Part of Phase 1 Admin Observability (US5).
 *
 * Per FR-014: Displays list of failed sagas with error details.
 * Per FR-015: Distinguishes compensated vs compensation-failed sagas.
 */
export function SagaFailureList() {
  const {
    data: result,
    loading,
    error,
  } = useCompanyData(async () => {
    const response = await adminService.getSagaLogs();
    return response.data;
  }, defaultSagaLogs);

  const getStepBadge = (step: string) => {
    switch (step) {
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'COMPENSATED':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPENSATION_FAILED':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
        <p className="text-red-600">Failed to load saga logs</p>
      </div>
    );
  }

  if (result.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-700 font-medium">
          No saga failures found
        </p>
        <p className="text-green-600 text-sm mt-1">
          All sagas completed successfully
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
              Saga Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Entity ID
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
              Step
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Error
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Timestamp
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {result.map((saga) => (
            <tr key={saga.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-sm">
                {saga.sagaType}
              </td>
              <td className="px-4 py-3 font-mono text-sm text-gray-500">
                {saga.entityId.slice(0, 8)}...
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStepBadge(
                    saga.step
                  )}`}
                >
                  {saga.step}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-red-600 max-w-xs truncate">
                {saga.error || '-'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {new Date(saga.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
