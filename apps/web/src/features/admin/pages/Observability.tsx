import { JournalOrphanList } from '@/features/admin/components/JournalOrphanList';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/Card';

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
    <PageContainer>
      <PageHeader
        title="System Observability"
        description="Monitor saga failures and journal integrity"
      />

      {/* Saga Failures Section */}

      {/* Journal Orphans Section */}
      <Card>
        <CardHeader className="border-b border-gray-200">
          <CardTitle>Orphan Journal Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <JournalOrphanList />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
