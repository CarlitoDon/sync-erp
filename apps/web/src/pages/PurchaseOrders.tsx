import { useState } from 'react';
import {
  purchaseOrderService,
  PurchaseOrder,
  CreatePurchaseOrderInput,
} from '../services/purchaseOrderService';
import { partnerService, Partner } from '../services/partnerService';
import { productService, Product } from '../services/productService';
import { useCompany } from '../contexts/CompanyContext';
import { useCompanyData } from '../hooks/useCompanyData';
import { apiAction } from '../hooks/useApiAction';
import ActionButton from '../components/ActionButton';

interface OrderItemForm {
  productId: string;
  quantity: number;
  price: number;
}

interface PurchaseOrdersData {
  orders: PurchaseOrder[];
  suppliers: Partner[];
  products: Product[];
}

export default function PurchaseOrders() {
  const { currentCompany } = useCompany();

  const {
    data: { orders, suppliers, products },
    loading,
    refresh: loadData,
  } = useCompanyData<PurchaseOrdersData>(
    async () => {
      const [ordersData, suppliersData, productsData] = await Promise.all([
        purchaseOrderService.list(),
        partnerService.listSuppliers(),
        productService.list(),
      ]);
      return {
        orders: ordersData,
        suppliers: suppliersData,
        products: productsData,
      };
    },
    {
      orders: [],
      suppliers: [],
      products: [],
    }
  );

  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState<CreatePurchaseOrderInput>({
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
      () => purchaseOrderService.create(formData),
      'Purchase Order created!'
    );
    if (result) {
      setShowForm(false);
      setFormData({ partnerId: '', items: [] });
      loadData();
    }
  };

  const handleConfirm = async (id: string) => {
    await apiAction(() => purchaseOrderService.confirm(id), 'Order confirmed!');
    loadData();
  };

  const handleGoodsReceipt = async (id: string) => {
    await apiAction(
      () => purchaseOrderService.processGoodsReceipt(id),
      'Goods received! Inventory updated.'
    );
    loadData();
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    await apiAction(() => purchaseOrderService.cancel(id), 'Order cancelled');
    loadData();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product?.name || productId;
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
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
        Please select a company to view purchase orders.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-500">Manage your purchasing workflow for {currentCompany.name}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Create PO'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">New Purchase Order</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
              <select
                required
                value={formData.partnerId}
                onChange={(e) => setFormData({ ...formData, partnerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select a supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium">Add Items</h3>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <select
                    value={currentItem.productId}
                    onChange={(e) => {
                      const product = products.find((p) => p.id === e.target.value);
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
                        {product.sku} - {product.name}
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
                      setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value) || 1 })
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
                      setCurrentItem({ ...currentItem, price: parseFloat(e.target.value) || 0 })
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
                      <th className="px-4 py-2 text-left text-sm">Product</th>
                      <th className="px-4 py-2 text-right text-sm">Qty</th>
                      <th className="px-4 py-2 text-right text-sm">Unit Price</th>
                      <th className="px-4 py-2 text-right text-sm">Total</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-2">{getProductName(item.productId)}</td>
                        <td className="px-4 py-2 text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-2 text-right">
                          {formatCurrency(item.quantity * item.price)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t font-semibold">
                      <td colSpan={3} className="px-4 py-2 text-right">
                        Total:
                      </td>
                      <td className="px-4 py-2 text-right">{formatCurrency(calculateTotal())}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            <button
              type="submit"
              disabled={formData.items.length === 0}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Create Purchase Order
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                PO Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Supplier
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Total
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
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No purchase orders found for this company.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm">{order.orderNumber}</td>
                  <td className="px-6 py-4">{order.partner?.name || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    {formatCurrency(Number(order.totalAmount))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {order.status === 'DRAFT' && (
                      <>
                        <ActionButton onClick={() => handleConfirm(order.id)} variant="primary">
                          Confirm
                        </ActionButton>
                        <ActionButton onClick={() => handleCancel(order.id)} variant="danger">
                          Cancel
                        </ActionButton>
                      </>
                    )}
                    {order.status === 'CONFIRMED' && (
                      <ActionButton onClick={() => handleGoodsReceipt(order.id)} variant="success">
                        Receive Goods
                      </ActionButton>
                    )}
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
