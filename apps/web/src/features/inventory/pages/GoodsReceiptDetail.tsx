import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import {
  getGoodsReceipt,
  GoodsReceiptResponse,
} from '@/features/inventory/services/inventoryService';
import { formatCurrency, formatDate } from '@/utils/format';

export default function GoodsReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();

  const [receipt, setReceipt] = useState<GoodsReceiptResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReceipt = async () => {
      if (!id || !currentCompany) return;
      setLoading(true);
      try {
        const data = await getGoodsReceipt(currentCompany.id, id);
        setReceipt(data);
      } catch (error) {
        console.error('Failed to load goods receipt:', error);
        navigate('/receipts');
      } finally {
        setLoading(false);
      }
    };
    loadReceipt();
  }, [id, currentCompany, navigate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'POSTED':
        return 'bg-green-100 text-green-800';
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Goods Receipt not found</div>
      </div>
    );
  }

  const totalValue = receipt.items.reduce(
    (sum, item) => sum + item.quantity * (item.unitCost || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/receipts')}
            className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
          >
            ← Back to Goods Receipts
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {receipt.number}
          </h1>
          <p className="text-gray-500">Goods Receipt Note</p>
        </div>
        <span
          className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(receipt.status)}`}
        >
          {receipt.status}
        </span>
      </div>

      {/* Details Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">
          Receipt Details
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500">GRN Number</p>
            <p className="font-mono font-medium">{receipt.number}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Purchase Order</p>
            <p className="font-medium">
              {receipt.purchaseOrder ? (
                <Link
                  to={`/purchase-orders/${receipt.purchaseOrderId}`}
                  className="text-blue-600 hover:underline"
                >
                  {receipt.purchaseOrder.orderNumber}
                </Link>
              ) : (
                '-'
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Date</p>
            <p className="font-medium">{formatDate(receipt.date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Value</p>
            <p className="font-medium text-primary-600">
              {formatCurrency(totalValue)}
            </p>
          </div>
        </div>
        {receipt.notes && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">Notes</p>
            <p className="text-gray-700">{receipt.notes}</p>
          </div>
        )}
      </div>

      {/* Items Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Received Items</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Product
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Quantity
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Unit Cost
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {receipt.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  {item.product ? (
                    <Link
                      to={`/products/${item.productId}`}
                      className="text-blue-600 hover:underline"
                    >
                      {item.product.name}
                    </Link>
                  ) : (
                    item.productId
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(item.unitCost || 0)}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatCurrency(
                    item.quantity * (item.unitCost || 0)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
