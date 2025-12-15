import { useState } from 'react';
import { formatCurrency } from '../../../utils/format';
import {
  salesOrderService,
  CreateSalesOrderInput,
} from '../services/salesOrderService';
import {
  partnerService,
  Partner,
} from '../../partners/services/partnerService';
import {
  productService,
  Product,
} from '../../inventory/services/productService';
import { useCompany } from '../../../contexts/CompanyContext';
import { useCompanyData } from '../../../hooks/useCompanyData';
import { apiAction } from '../../../hooks/useApiAction';
import ActionButton from '../../../components/ui/ActionButton';
import FormModal from '../../../components/ui/FormModal';
import SalesOrderList from '../components/SalesOrderList';

interface OrderItemForm {
  productId: string;
  quantity: number;
  price: number;
}

interface SalesOrdersData {
  customers: Partner[];
  products: Product[];
}

export default function SalesOrders() {
  const { currentCompany } = useCompany();
  // const confirm = useConfirm();

  const {
    data: { customers, products },
    loading,
    refresh: loadData,
  } = useCompanyData<SalesOrdersData>(
    async () => {
      const [customersData, productsData] =
        await Promise.all([
          partnerService.listCustomers(),
          productService.list(),
        ]);
      return {
        customers: customersData,
        products: productsData,
      };
    },
    {
      customers: [],
      products: [],
    }
  );


  const [isModalOpen, setIsModalOpen] = useState(false);





  const [formData, setFormData] = useState<CreateSalesOrderInput>({
    partnerId: '',
    items: [],
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

    const result = await apiAction(
      () => salesOrderService.create(formData),
      'Sales Order created!'
    );
    if (result) {
      handleClose();
      loadData();
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setFormData({ partnerId: '', items: [] });
    setCurrentItem({ productId: '', quantity: 1, price: 0 });
  };
  
  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
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
        Please select a company to view sales orders.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Sales Orders
          </h1>
          <p className="text-gray-500">
            Manage customer orders and deliveries for{' '}
            {currentCompany.name}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Create SO
        </button>
      </div>

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
              <select
                required
                value={formData.partnerId}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    partnerId: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Rate
              </label>
              <select
                value={formData.taxRate || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    taxRate: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value={0}>No Tax (0%)</option>
                <option value={11}>PPN 11%</option>
                <option value={12}>PPN 12%</option>
              </select>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium">Add Items</h3>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <select
                    value={currentItem.productId}
                    onChange={(e) => {
                      const product = products.find(
                        (p) => p.id === e.target.value
                      );
                      setCurrentItem({
                        ...currentItem,
                        productId: e.target.value,
                        price: product ? Number(product.price) : 0,
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} - {product.name} (Stock:{' '}
                        {product.stockQty})
                      </option>
                    ))}
                  </select>
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
                          <tr className={totals.taxRate > 0 ? 'border-t-2 font-semibold' : 'font-semibold'}>
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
    </div>
  );
}
