import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CreateProductInput } from '@/types/api';
import { trpc } from '@/lib/trpc';

import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import ActionButton from '@/components/ui/ActionButton';
import FormModal from '@/components/ui/FormModal';
import { CurrencyInput, LoadingState, NoCompanySelected, Input } from '@/components/ui';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { Card } from '@/components/ui/Card';

export default function Products() {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const { data: products = [], isLoading: loading } =
    trpc.product.list.useQuery(undefined, {
      enabled: !!currentCompany?.id,
    });

  const createMutation = trpc.product.create.useMutation({
    onSuccess: () => utils.product.list.invalidate(),
  });

  const deleteMutation = trpc.product.delete.useMutation({
    onSuccess: () => utils.product.list.invalidate(),
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<CreateProductInput>({
    sku: '',
    name: '',
    price: 0,
  });

  const resetForm = () => {
    setFormData({ sku: '', name: '', price: 0 });
  };

  const handleClose = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await apiAction(
      () => createMutation.mutateAsync(formData),
      'Product created!'
    );
    if (result) {
      handleClose();
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
      () => deleteMutation.mutateAsync({ id }),
      'Product deleted'
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(value);
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!currentCompany) {
    return <NoCompanySelected message="Please select a company to view products." />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Products"
        description="Manage your product catalog"
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Add Product
          </button>
        }
      />

      {/* Modal Form */}
      <FormModal
        isOpen={isModalOpen}
        onClose={handleClose}
        title="New Product"
      >
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-3 gap-4"
        >
          <Input
            label="SKU"
            type="text"
            required
            value={formData.sku}
            onChange={(e) =>
              setFormData({ ...formData, sku: e.target.value })
            }
            placeholder="e.g., PROD-001"
          />
          <Input
            label="Name"
            type="text"
            required
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Selling Price *
            </label>
            <CurrencyInput
              value={formData.price}
              onChange={(val) =>
                setFormData({
                  ...formData,
                  price: val,
                })
              }
              min={0}
            />
          </div>
          <div className="col-span-3 flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create Product
            </button>
          </div>
        </form>
      </FormModal>

      <Card className="overflow-hidden">
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
                    <Link
                      to={`/products/${product.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {product.name}
                    </Link>
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
      </Card>
    </PageContainer>
  );
}
