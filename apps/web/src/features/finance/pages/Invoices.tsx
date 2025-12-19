import { useCompany } from '@/contexts/CompanyContext';
import { InvoiceList } from '@/features/finance/components/InvoiceList';

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Invoices
          </h1>
          <p className="text-gray-500">
            Accounts Receivable - Customer invoices for{' '}
            {currentCompany.name}
          </p>
        </div>
      </div>

      <InvoiceList />
    </div>
  );
}
