import { Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { formatDate } from '@/utils/format';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui';

export default function GoodsReceipts() {
  const { currentCompany } = useCompany();
  const { data: receipts = [], isLoading: loading } =
    trpc.inventory.listGRN.useQuery(undefined, {
      enabled: !!currentCompany?.id,
    });

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
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Goods Receipts"
        description="Goods Receipt Notes (GRN) from Purchase Orders"
      />

      <Card className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                GRN Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Purchase Order
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
            {receipts.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No goods receipts found.
                </td>
              </tr>
            ) : (
              receipts.map((receipt: any) => (
                <tr key={receipt.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm">
                    <Link
                      to={`/receipts/${receipt.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {receipt.number}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {receipt.order ? (
                      <Link
                        to={`/purchase-orders/${receipt.orderId}`}
                        className="text-blue-600 hover:underline"
                      >
                        {receipt.order.orderNumber}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatDate(receipt.date)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(receipt.status)}`}
                    >
                      {receipt.status}
                    </span>
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
