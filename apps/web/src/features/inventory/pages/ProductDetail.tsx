import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import ActionButton from '@/components/ui/ActionButton';
import { formatCurrency, formatDate } from '@/utils/format';
import { PageContainer } from '@/components/layout/PageLayout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/Card';
import { LoadingState } from '@/components/ui';
import { MovementTypeSchema } from '@sync-erp/shared';

type Tab = 'history';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<Tab>('history');

  const {
    data: product,
    isLoading: loading,
    error,
  } = trpc.product.getById.useQuery(
    { id: id! },
    { enabled: !!id && !!currentCompany?.id }
  );

  const { data: movements = [], isLoading: loadingMovements } =
    trpc.inventory.getMovements.useQuery(
      { productId: id },
      {
        enabled:
          !!id && !!currentCompany?.id && activeTab === 'history',
      }
    );

  if (loading && !product) {
    return <LoadingState />;
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
    <PageContainer>
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
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </label>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {formatCurrency(Number(product.price))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Average Cost
                  </label>
                  <div className="mt-1 text-lg font-medium text-gray-900">
                    {formatCurrency(Number(product.averageCost))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock Quantity
                  </label>
                  <div className="mt-1 text-lg font-medium text-gray-900">
                    {product.stockQty}
                  </div>
                </div>
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
            </CardContent>
          </Card>
        </div>

        {/* Main Content Areas */}
        <div className="md:col-span-2">
          <Card className="overflow-hidden min-h-[500px]">
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
                    <LoadingState size="md" />
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
                                  movement.type ===
                                  MovementTypeSchema.enum.IN
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
                                movement.type ===
                                MovementTypeSchema.enum.IN
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {movement.type ===
                              MovementTypeSchema.enum.IN
                                ? '+'
                                : '-'}
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
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
