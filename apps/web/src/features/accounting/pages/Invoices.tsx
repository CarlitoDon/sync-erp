import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { InvoiceList } from '@/features/accounting/components/InvoiceList';
import { NoCompanySelected } from '@/components/ui';

export default function Invoices() {
  const { currentCompany } = useCompany();

  if (!currentCompany) {
    return <NoCompanySelected message="Please select a company to view invoices." />;
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
