import { Link } from 'react-router-dom';
import { useCompanyData } from '@/hooks/useCompanyData';
import {
  listShipments,
  ShipmentResponse,
} from '@/features/inventory/services/inventoryService';
import { formatDate } from '@/utils/format';

export default function Shipments() {
  const {
    data: shipments,
    loading,
  } = useCompanyData<ShipmentResponse[]>(
    (companyId) => listShipments(companyId),
    []
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Shipments
          </h1>
          <p className="text-gray-500">
            Delivery Notes / Shipments from Sales Orders
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Shipment Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Sales Order
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Items
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shipments.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No shipments found.
                </td>
              </tr>
            ) : (
              shipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm">
                    <Link
                      to={`/shipments/${shipment.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {shipment.number}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
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
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatDate(shipment.date)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {shipment.items?.length || 0}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(shipment.status)}`}
                    >
                      {shipment.status}
                    </span>
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
