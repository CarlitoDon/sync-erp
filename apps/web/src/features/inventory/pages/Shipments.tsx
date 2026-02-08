import { Link } from 'react-router-dom';
import { formatDate } from '@/utils/format';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { Card } from '@/components/ui/Card';
import { LoadingState, StatusBadge } from '@/components/ui';

export default function Shipments() {
  const { currentCompany } = useCompany();
  const { data: shipments = [], isLoading: loading } =
    trpc.inventory.listShipments.useQuery(undefined, {
      enabled: !!currentCompany?.id,
    });

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Shipments"
        description="Delivery Notes / Shipments from Sales Orders"
      />

      <Card className="overflow-hidden">
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
              shipments.map(
                (shipment: {
                  id: string;
                  number: string;
                  orderId: string;
                  date: Date;
                  status: string;
                  order?: { orderNumber: string | null } | null;
                }) => (
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
                      {shipment.order ? (
                        <Link
                          to={`/sales-orders/${shipment.orderId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {shipment.order.orderNumber}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatDate(shipment.date)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge
                        status={shipment.status}
                        domain="document"
                      />
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}
