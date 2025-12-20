import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import { trpc } from '@/lib/trpc';
import { formatCurrency, formatDate } from '@/utils/format';
import { BackButton } from '@/components/ui/BackButton';

export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();

  const {
    data: shipment,
    isLoading: loading,
    error,
  } = trpc.inventory.getShipment.useQuery(
    { id: id! },
    { enabled: !!id && !!currentCompany?.id }
  );

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

  if (error) {
    console.error('Failed to load shipment:', error);
    navigate('/shipments');
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Shipment not found</div>
      </div>
    );
  }

  const totalCOGS = shipment.items.reduce(
    (sum, item) =>
      sum + Number(item.quantity) * Number(item.costSnapshot || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton to="/shipments" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {shipment.number}
            </h1>
            <p className="text-sm text-gray-500">
              Shipment / Delivery Note
            </p>
          </div>
        </div>
        <span
          className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(shipment.status)}`}
        >
          {shipment.status}
        </span>
      </div>

      {/* Details Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">
          Shipment Details
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500">Shipment Number</p>
            <p className="font-mono font-medium">{shipment.number}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Sales Order</p>
            <p className="font-medium">
              {shipment.salesOrder ? (
                <Link
                  to={`/sales-orders/${shipment.salesOrderId}`}
                  className="text-blue-600 hover:underline"
                >
                  {shipment.salesOrder.orderNumber}
                </Link>
              ) : (
                '-'
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Date</p>
            <p className="font-medium">{formatDate(shipment.date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total COGS</p>
            <p className="font-medium text-primary-600">
              {formatCurrency(totalCOGS)}
            </p>
          </div>
        </div>
        {shipment.notes && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">Notes</p>
            <p className="text-gray-700">{shipment.notes}</p>
          </div>
        )}
      </div>

      {/* Items Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Shipped Items</h2>
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
                Unit Cost (COGS)
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Total COGS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shipment.items.map((item) => (
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
                  {Number(item.quantity)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(Number(item.costSnapshot || 0))}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatCurrency(
                    Number(item.quantity) *
                      Number(item.costSnapshot || 0)
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
