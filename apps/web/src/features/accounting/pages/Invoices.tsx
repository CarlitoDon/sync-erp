import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { InvoiceList } from '@/features/accounting/components/InvoiceList';

export default function Invoices() {
  const { currentCompany } = useCompany();

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Please select a company to view invoices.
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Invoices"
        description={`Accounts Receivable - Customer invoices for ${currentCompany.name}`}
      />

      <InvoiceList />
    </PageContainer>
  );
}
