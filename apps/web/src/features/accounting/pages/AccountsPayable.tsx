import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { BillList } from '@/features/accounting/components/BillList';

export default function AccountsPayable() {
  const { currentCompany } = useCompany();

  if (!currentCompany) {
    return (
      <div className="p-8 text-center text-gray-500">
        Please select a company.
      </div>
    );
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
