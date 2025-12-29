import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { BillList } from '@/features/accounting/components/BillList';
import { NoCompanySelected } from '@/components/ui';

export default function AccountsPayable() {
  const { currentCompany } = useCompany();

  if (!currentCompany) {
    return <NoCompanySelected message="Please select a company to view bills." />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Bills"
        description={`Accounts Payable - Supplier bills for ${currentCompany.name}`}
      />

      <BillList />
    </PageContainer>
  );
}
