import { Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { StockAdjustmentModal } from '@/features/inventory/components/StockAdjustmentModal';
import ActionButton from '@/components/ui/ActionButton';
import { useState, useMemo } from 'react';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { LoadingState, NoCompanySelected } from '@/components/ui';

export default function Inventory() {
  const { currentCompany } = useCompany();
  const {
    data: stockLevels = [],
    isLoading: loading,
    refetch: loadStockLevels,
  } = trpc.inventory.getStockLevels.useQuery(undefined, {
    enabled: !!currentCompany?.id,
  });

  const [adjustingProductId, setAdjustingProductId] = useState<
    string | null
  >(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(value);
  };

  // Memoize computed values to avoid recalculation on every render
  const { totalValue, totalUnits, lowStockItems, outOfStockItems } =
    useMemo(() => {
      const value = stockLevels.reduce(
        (sum, item) => sum + item.stockQty * Number(item.averageCost),
        0
      );
      const units = stockLevels.reduce(
        (sum, item) => sum + item.stockQty,
        0
      );
      const lowStock = stockLevels.filter(
        (item) => item.stockQty < 10 && item.stockQty > 0
      );
      const outOfStock = stockLevels.filter(
        (item) => item.stockQty <= 0
      );
      return {
        totalValue: value,
        totalUnits: units,
        lowStockItems: lowStock,
        outOfStockItems: outOfStock,
      };
    }, [stockLevels]);

  if (loading) {
    return <LoadingState />;
  }

  if (!currentCompany) {
    return (
      <NoCompanySelected message="Please select a company to view inventory." />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Inventory"
        description={`Stock levels and inventory value for ${currentCompany.name}`}
        actions={
          <button
            onClick={() => loadStockLevels()}
            className="px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
          >
            ↻ Refresh
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 uppercase">
              Total Products
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {stockLevels.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 uppercase">
              Total Units in Stock
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {totalUnits.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 uppercase">
              Total Inventory Value
            </p>
            <p className="text-3xl font-bold text-primary-600 mt-2">
              {formatCurrency(totalValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h3 className="font-semibold text-yellow-800">
            ⚠️ Low Stock Warning
          </h3>
          <p className="text-yellow-700 text-sm mt-1">
            {lowStockItems.length} products have low stock levels
            (below 10 units)
          </p>
        </div>
      )}

      {/* Out of Stock Alert */}
      {outOfStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-800">
            🚨 Out of Stock
          </h3>
          <p className="text-red-700 text-sm mt-1">
            {outOfStockItems.length} products are out of stock
          </p>
        </div>
      )}

      {/* Stock Table */}
      <Card className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Product
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Stock Qty
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Avg Cost
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Selling Price
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Stock Value
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {stockLevels.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No products in inventory. Add products and process
                  goods receipts.
                </td>
              </tr>
            ) : (
              stockLevels.map((item) => {
                const stockValue =
                  item.stockQty * Number(item.averageCost);
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm">
                      <Link
                        to={`/products/${item.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {item.sku}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <Link
                        to={`/products/${item.id}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">
                      {item.stockQty.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {formatCurrency(Number(item.averageCost))}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {formatCurrency(Number(item.price))}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-primary-600">
                      {formatCurrency(stockValue)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.stockQty <= 0
                            ? 'bg-red-100 text-red-800'
                            : item.stockQty < 10
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {item.stockQty <= 0
                          ? 'Out of Stock'
                          : item.stockQty < 10
                            ? 'Low Stock'
                            : 'In Stock'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ActionButton
                        onClick={() => setAdjustingProductId(item.id)}
                        variant="primary"
                      >
                        Adjust
                      </ActionButton>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {adjustingProductId && (
        <StockAdjustmentModal
          isOpen={!!adjustingProductId}
          onClose={() => setAdjustingProductId(null)}
          onSuccess={loadStockLevels}
          initialProductId={adjustingProductId}
        />
      )}
    </PageContainer>
  );
}
