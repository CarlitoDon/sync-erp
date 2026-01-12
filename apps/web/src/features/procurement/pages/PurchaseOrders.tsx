import { useState } from 'react';
import { NoCompanySelected } from '@/components/ui';
import { useCompany } from '@/contexts/CompanyContext';
import PurchaseOrderList from '@/features/procurement/components/PurchaseOrderList';
import CreatePurchaseOrderModal from '@/features/procurement/components/CreatePurchaseOrderModal';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';

export default function PurchaseOrders() {
  const { currentCompany } = useCompany();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!currentCompany) {
    return (
      <NoCompanySelected message="Please select a company to view purchase orders." />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Purchase Orders"
        description={`Manage your purchasing workflow for ${currentCompany.name}`}
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Create PO
          </button>
        }
      />

      <CreatePurchaseOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <PurchaseOrderList />
    </PageContainer>
  );
}
