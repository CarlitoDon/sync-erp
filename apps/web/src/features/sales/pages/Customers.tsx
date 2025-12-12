import { useState } from 'react';
import {
  partnerService,
  Partner,
  CreatePartnerInput,
} from '../services/partnerService';
import { useCompany } from '../contexts/CompanyContext';
import { useCompanyData } from '../hooks/useCompanyData';
import { apiAction } from '../hooks/useApiAction';
import { useConfirm } from '../components/ui/ConfirmModal';
import ActionButton from '../components/ui/ActionButton';

export default function Customers() {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const {
    data: customers,
    loading,
    refresh: loadCustomers,
  } = useCompanyData<Partner[]>(partnerService.listCustomers, []);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreatePartnerInput>({
    name: '',
    email: '',
    phone: '',
    address: '',
    type: 'CUSTOMER',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await apiAction(
      () => partnerService.create(formData),
      'Customer created!'
    );
    if (result) {
      setShowForm(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        type: 'CUSTOMER',
      });
      loadCustomers();
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Customer',
      message: 'Are you sure you want to delete this customer?',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => partnerService.delete(id),
      'Customer deleted'
    );
    loadCustomers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Please select a company to view customers.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Customers
          </h1>
          <p className="text-gray-500">
            Manage your customer relationships for{' '}
            {currentCompany.name}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Customer'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">New Customer</h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-2">
              <button
                type="submit"
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Create Customer
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Address
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {customers.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No customers found for this company.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {customer.name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {customer.email || '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {customer.phone || '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {customer.address || '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ActionButton
                      onClick={() => handleDelete(customer.id)}
                      variant="danger"
                    >
                      Delete
                    </ActionButton>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
