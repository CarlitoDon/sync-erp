import { useState } from 'react';
import {
  productService,
  Product,
  CreateProductInput,
} from '../services/productService';
import { useCompany } from '../../../contexts/CompanyContext';
import { useCompanyData } from '../../../hooks/useCompanyData';
import { apiAction } from '../../../hooks/useApiAction';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import ActionButton from '../../../components/ui/ActionButton';

export default function Products() {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  // Using the new hook
  const {
    data: products,
    loading,
    refresh: loadProducts,
  } = useCompanyData<Product[]>(productService.list, []);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateProductInput>({
    sku: '',
    name: '',
    price: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await apiAction(
      () => productService.create(formData),
      'Product created!'
    );
    if (result) {
      setShowForm(false);
      setFormData({ sku: '', name: '', price: 0 });
      loadProducts();
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Product',
      message: 'Are you sure you want to delete this product?',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => productService.delete(id),
      'Product deleted'
    );
    loadProducts();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(value);
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
        Please select a company to view products.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Products
          </h1>
          <p className="text-gray-500">Manage your product catalog</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Product'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">New Product</h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU *
              </label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., PROD-001"
              />
            </div>
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
                Selling Price *
              </label>
              <input
                type="number"
                required
                min={0}
                step={0.01}
                value={formData.price}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-3">
              <button
                type="submit"
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Create Product
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
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Price
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Avg Cost
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Stock
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No products found for this company.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm text-gray-600">
                    {product.sku}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500">
                    {formatCurrency(Number(product.price))}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500">
                    {formatCurrency(Number(product.averageCost))}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        product.stockQty <= 0
                          ? 'bg-red-100 text-red-800'
                          : product.stockQty < 10
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {product.stockQty}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ActionButton
                      onClick={() => handleDelete(product.id)}
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
