import { useState } from 'react';
import { type PaymentTerms } from '@sync-erp/shared';
import { formatCurrency } from '@/utils/format';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import ActionButton from '@/components/ui/ActionButton';
import FormModal from '@/components/ui/FormModal';
import SalesOrderList from '@/features/sales/components/SalesOrderList';
import Select from '@/components/ui/Select';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import PaymentModeSelector from '@/components/forms/PaymentModeSelector';

interface OrderItemForm {
  productId: string;
  quantity: number;
  price: number;
}

export default function SalesOrders() {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  const { data: customers } = trpc.partner.list.useQuery(
    { type: 'CUSTOMER' },
    { enabled: !!currentCompany?.id, initialData: [] }
  );

  const { data: products } = trpc.product.list.useQuery(undefined, {
    enabled: !!currentCompany?.id,
    initialData: [],
  });

  const createMutation = trpc.salesOrder.create.useMutation({
    onSuccess: () => {
      utils.salesOrder.list.invalidate();
    },
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    partnerId: '',
    items: [] as OrderItemForm[],
    taxRate: 0,
  });

  // Payment mode state
  const [paymentConfig, setPaymentConfig] = useState({
    // eslint-disable-next-line @sync-erp/no-hardcoded-enum
    mode: 'TEMPO' as 'TEMPO' | 'UPFRONT' | 'COD',
    paymentTerms: 'NET30',
    withDP: false,
    dpPercent: 0,
    dpAmount: 0,
  });

  const [currentItem, setCurrentItem] = useState<OrderItemForm>({
    productId: '',
    quantity: 1,
    price: 0,
  });

  const handleAddItem = () => {
    if (!currentItem.productId || currentItem.quantity <= 0) return;
    setFormData({
      ...formData,
      items: [...formData.items, currentItem],
    });
    setCurrentItem({ productId: '', quantity: 1, price: 0 });
  };

  const handleRemoveItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partnerId || formData.items.length === 0) return;

    await apiAction(
      () =>
        createMutation.mutateAsync({
          ...formData,
          type: 'SALES',
          paymentTerms: paymentConfig.paymentTerms as PaymentTerms,
          dpPercent: paymentConfig.withDP
            ? paymentConfig.dpPercent
            : undefined,
          dpAmount: paymentConfig.withDP
            ? paymentConfig.dpAmount
            : undefined,
        }),
      'Sales Order created!'
    );
    handleClose();
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setFormData({ partnerId: '', items: [], taxRate: 0 });
    setPaymentConfig({
      mode: 'TEMPO',
      paymentTerms: 'NET30',
      withDP: false,
      dpPercent: 0,
      dpAmount: 0,
    });
    setCurrentItem({ productId: '', quantity: 1, price: 0 });
  };

  const getProductName = (productId: string) => {
    const product = products?.find((p) => p.id === productId);
    return product?.name || productId;
  };

  const calculateTotal = () => {
    const subtotal = formData.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    const taxRate = formData.taxRate || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const grandTotal = subtotal + taxAmount;
    return { subtotal, taxAmount, grandTotal, taxRate };
  };

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Please select a company to view sales orders.
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Sales Orders"
        description={`Manage customer orders and deliveries for ${currentCompany.name}`}
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Create SO
          </button>
        }
      />

      {/* Modal Form */}
      <FormModal
        isOpen={isModalOpen}
        onClose={handleClose}
        title="New Sales Order"
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer *
            </label>
            <Select
              required
              value={formData.partnerId}
              onChange={(val) =>
                setFormData({
                  ...formData,
                  partnerId: val,
                })
              }
              options={
                customers?.map((c) => ({
                  value: c.id,
                  label: c.name,
                })) || []
              }
              placeholder="Select a customer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax Rate
            </label>
            <Select
              value={formData.taxRate || 0}
              onChange={(val) =>
                setFormData({
                  ...formData,
                  taxRate: Number(val),
                })
              }
              options={[
                { value: 0, label: 'No Tax (0%)' },
                { value: 11, label: 'PPN 11%' },
                { value: 12, label: 'PPN 12%' },
              ]}
            />
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-medium">Add Items</h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Select
                  value={currentItem.productId}
                  onChange={(val) => {
                    const product = products?.find(
                      (p) => p.id === val
                    );
                    setCurrentItem({
                      ...currentItem,
                      productId: val,
                      price: product ? Number(product.price) : 0,
                    });
                  }}
                  options={
                    products?.map((p) => ({
                      value: p.id,
                      label: `${p.sku} - ${p.name} (Stock: ${p.stockQty})`,
                    })) || []
                  }
                  placeholder="Select product"
                />
              </div>
              <div>
                <input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={currentItem.quantity}
                  onChange={(e) =>
                    setCurrentItem({
                      ...currentItem,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Unit Price"
                  value={currentItem.price}
                  onChange={(e) =>
                    setCurrentItem({
                      ...currentItem,
                      price: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Add
              </button>
            </div>

            {formData.items.length > 0 && (
              <table className="w-full mt-4">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm">
                      Product
                    </th>
                    <th className="px-4 py-2 text-right text-sm">
                      Qty
                    </th>
                    <th className="px-4 py-2 text-right text-sm">
                      Unit Price
                    </th>
                    <th className="px-4 py-2 text-right text-sm">
                      Total
                    </th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2">
                        {getProductName(item.productId)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatCurrency(item.quantity * item.price)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <ActionButton
                          onClick={() => handleRemoveItem(index)}
                          variant="danger"
                        >
                          Remove
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                  {/* Total Summary */}
                  {(() => {
                    const totals = calculateTotal();
                    return (
                      <>
                        <tr className="border-t">
                          <td
                            colSpan={3}
                            className="px-4 py-2 text-right text-gray-600"
                          >
                            Subtotal:
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatCurrency(totals.subtotal)}
                          </td>
                          <td></td>
                        </tr>
                        {totals.taxRate > 0 && (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-4 py-2 text-right text-gray-600"
                            >
                              PPN ({totals.taxRate}%):
                            </td>
                            <td className="px-4 py-2 text-right">
                              {formatCurrency(totals.taxAmount)}
                            </td>
                            <td></td>
                          </tr>
                        )}
                        <tr
                          className={
                            totals.taxRate > 0
                              ? 'border-t-2 font-semibold'
                              : 'font-semibold'
                          }
                        >
                          <td
                            colSpan={3}
                            className="px-4 py-2 text-right"
                          >
                            Total:
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatCurrency(totals.grandTotal)}
                          </td>
                          <td></td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            )}
          </div>

          {/* Payment Mode Selector - After items */}
          <PaymentModeSelector
            totalAmount={calculateTotal().grandTotal}
            value={paymentConfig}
            onChange={setPaymentConfig}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formData.items.length === 0}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Create Sales Order
            </button>
          </div>
        </form>
      </FormModal>

      <SalesOrderList />
    </PageContainer>
  );
}
