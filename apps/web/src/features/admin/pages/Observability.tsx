import { SagaFailureList } from '@/features/admin/components/SagaFailureList';
import { JournalOrphanList } from '@/features/admin/components/JournalOrphanList';

/**
 * Observability page for admin users.
 * Part of Phase 1 Admin Observability (US5).
 *
 * Per FR-014: Displays list of failed sagas with error details.
 * Per FR-015: Distinguishes compensated vs compensation-failed sagas.
 * Per FR-016: Displays journal entries with missing/invalid source references.
 */
export default function Observability() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          System Observability
        </h1>
        <p className="text-gray-600 mt-1">
          Monitor saga failures and journal integrity
        </p>
      </div>

      {/* Saga Failures Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Saga Failures
        </h2>
        <SagaFailureList />
      </div>

      {/* Journal Orphans Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Orphan Journal Entries
        </h2>
        <JournalOrphanList />
      </div>
    </div>
  );
}
