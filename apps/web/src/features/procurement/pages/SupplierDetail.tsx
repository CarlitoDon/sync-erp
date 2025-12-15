import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useCompanyData } from '../../../hooks/useCompanyData';
import {
  partnerService,
  Partner,
} from '../../partners/services/partnerService';
import ActionButton from '../../../components/ui/ActionButton';
import PurchaseOrderList from '../components/PurchaseOrderList';
import { BillList } from '../../finance/components/BillList';
import { formatDate } from '../../../utils/format';

type Tab = 'orders' | 'bills' | 'payments';

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('orders');

  const fetchSupplier = useCallback(async () => {
    if (!id) return null;
    return await partnerService.getById(id);
  }, [id]);

  const {
    data: supplier,
    loading,
    error,
    refresh,
  } = useCompanyData<Partner | null>(fetchSupplier, null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading && !supplier) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || (!loading && !supplier)) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Supplier not found</h2>
        <ActionButton
          onClick={() => window.history.back()}
          variant="secondary"
          className="mt-4"
        >
          Go Back
        </ActionButton>
      </div>
    );
  }

  if (!supplier) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => window.history.back()}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeftIcon className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium text-xs">
              Supplier
            </span>
            <span>•</span>
            <span>Joined {formatDate(supplier.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Supplier Info Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Contact Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </label>
                <div className="mt-1 text-sm text-gray-900">
                  {supplier.email ? (
                    <a
                      href={`mailto:${supplier.email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {supplier.email}
                    </a>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </label>
                <div className="mt-1 text-sm text-gray-900">
                  {supplier.phone || '-'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </label>
                <div className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                  {supplier.address || '-'}
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-100">
              <ActionButton
                 onClick={() => { /* Edit Layout Placeholder */ }}
                 variant="secondary"
                 className="w-full justify-center"
                 disabled
              >
                Edit Supplier
              </ActionButton>
            </div>
          </div>
        </div>

        {/* Main Content Areas */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'orders'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Purchase Orders
                </button>
                <button
                   onClick={() => setActiveTab('bills')}
                  className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'bills'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Bills
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'orders' && (
                <PurchaseOrderList filter={{ partnerId: id }} />
              )}
              {activeTab === 'bills' && (
                <BillList filter={{ partnerId: id }} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
