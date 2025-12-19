import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useCompanyData } from '@/hooks/useCompanyData';
import { productService, Product } from '@/features/inventory/services/productService';
import { getMovements } from '@/features/inventory/services/inventoryService';
import type { InventoryMovement } from '@sync-erp/shared';
import ActionButton from '@/components/ui/ActionButton';
import { formatCurrency, formatDate } from '@/utils/format';

type Tab = 'history';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const fetchProduct = useCallback(async () => {
    if (!id) return null;
    return await productService.getById(id);
  }, [id]);

  const {
    data: product,
    loading,
    error,
    refresh,
  } = useCompanyData<Product | null>(fetchProduct, null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const loadMovements = async () => {
      if (!id) return;
      setLoadingMovements(true);
      try {
        const data = await getMovements(id);
        setMovements(data);
      } catch (err) {
        console.error('Failed to load movements', err);
      } finally {
        setLoadingMovements(false);
      }
    };

    if (activeTab === 'history') {
      loadMovements();
    }
  }, [id, activeTab]);

  if (loading && !product) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || (!loading && !product)) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">
          Product not found
        </h2>
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

  if (!product) return null;

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
          <h1 className="text-2xl font-bold text-gray-900">
            {product.name}
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="font-mono text-gray-600">
              {product.sku}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Product Info Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Product Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </label>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {formatCurrency(Number(product.price))}
                </div>
              </div>
              {/* Description removed as not in Product type yet */}
              {/* <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </label>
                <div className="mt-1 text-sm text-gray-900">
                  -
                </div>
              </div> */}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <ActionButton
                onClick={() => {
                  /* Edit Layout Placeholder */
                }}
                variant="secondary"
                className="w-full justify-center"
                disabled
              >
                Edit Product
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
                  onClick={() => setActiveTab('history')}
                  className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'history'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Stock History
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'history' && (
                <div className="overflow-x-auto">
                  {loadingMovements ? (
                    <div className="flex justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : movements.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No stock movements recorded.
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Reference
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Qty
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {movements.map((movement) => (
                          <tr key={movement.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(movement.date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  movement.type === 'IN'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {movement.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {movement.reference || '-'}
                            </td>
                            <td
                              className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                                movement.type === 'IN'
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {movement.type === 'IN' ? '+' : '-'}
                              {movement.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
