import {
  productService,
  StockLevel,
} from '../services/productService';
import { useCompany } from '../../../contexts/CompanyContext';
import { useCompanyData } from '../../../hooks/useCompanyData';

export default function Inventory() {
  const { currentCompany } = useCompany();
  const {
    data: stockLevels,
    loading,
    refresh: loadStockLevels,
  } = useCompanyData<StockLevel[]>(productService.getStockLevels, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(value);
  };

  const getTotalValue = () => {
    return stockLevels.reduce(
      (sum, item) => sum + item.stockQty * Number(item.averageCost),
      0
    );
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
        Please select a company to view inventory.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Inventory
          </h1>
          <p className="text-gray-500">
            Stock levels and inventory value for {currentCompany.name}
          </p>
        </div>
        <button
          onClick={loadStockLevels}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">
            Total Products
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {stockLevels.length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">
            Total Units in Stock
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {stockLevels
              .reduce((sum, item) => sum + item.stockQty, 0)
              .toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 uppercase">
            Total Inventory Value
          </p>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {formatCurrency(getTotalValue())}
          </p>
        </div>
      </div>

      {/* Low Stock Alert */}
      {stockLevels.filter(
        (item) => item.stockQty < 10 && item.stockQty > 0
      ).length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h3 className="font-semibold text-yellow-800">
            ⚠️ Low Stock Warning
          </h3>
          <p className="text-yellow-700 text-sm mt-1">
            {
              stockLevels.filter(
                (item) => item.stockQty < 10 && item.stockQty > 0
              ).length
            }{' '}
            products have low stock levels (below 10 units)
          </p>
        </div>
      )}

      {/* Out of Stock Alert */}
      {stockLevels.filter((item) => item.stockQty <= 0).length >
        0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-800">
            🚨 Out of Stock
          </h3>
          <p className="text-red-700 text-sm mt-1">
            {stockLevels.filter((item) => item.stockQty <= 0).length}{' '}
            products are out of stock
          </p>
        </div>
      )}

      {/* Stock Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                    <td className="px-6 py-4 font-mono text-sm text-gray-600">
                      {item.sku}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {item.name}
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
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
