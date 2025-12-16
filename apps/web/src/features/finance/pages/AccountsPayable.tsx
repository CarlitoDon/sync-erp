import { useCompany } from '../../../contexts/CompanyContext';
import { BillList } from '../components/BillList';

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
          <p className="text-gray-500">
            Accounts Payable - Supplier bills for{' '}
            {currentCompany.name}
          </p>
        </div>
        {/* Create button is now handled within BillList for context awareness */}
      </div>

      <BillList />
    </div>
  );
}
