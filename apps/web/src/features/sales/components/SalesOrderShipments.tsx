import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatusBadge,
  ActionButton,
} from '@/components/ui';
import { DocumentStatusSchema } from '@sync-erp/shared';
import { Link } from 'react-router-dom';
import { RouterOutputs } from '@/lib/trpc';

import CreateInvoiceModal from '@/features/accounting/components/CreateInvoiceModal';
import { useState } from 'react';

type SalesOrder = NonNullable<RouterOutputs['salesOrder']['getById']>;

interface SalesOrderShipmentsProps {
  fulfillments: SalesOrder['fulfillments'];
}

export function SalesOrderShipments({
  fulfillments,
}: SalesOrderShipmentsProps) {
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<
    string | null
  >(null);

  if (!fulfillments || fulfillments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Shipment Number
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Linked Invoice
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {fulfillments.map((shipment) => {
                const linkedInvoice = shipment.invoices?.[0];
                return (
                  <tr key={shipment.id}>
                    <td className="px-4 py-3 font-mono">
                      {shipment.number}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={shipment.status}
                        domain="document"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {linkedInvoice ? (
                        <Link
                          to={`/invoices/${linkedInvoice.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-mono"
                        >
                          {linkedInvoice.invoiceNumber}
                        </Link>
                      ) : (
                        <span className="text-gray-400 italic">
                          No invoice created
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!linkedInvoice &&
                        shipment.status ===
                          DocumentStatusSchema.enum.POSTED && (
                          <ActionButton
                            variant="primary"
                            onClick={() => {
                              setSelectedShipmentId(shipment.id);
                              setIsInvoiceModalOpen(true);
                            }}
                          >
                            Create Invoice
                          </ActionButton>
                        )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      <CreateInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false);
          setSelectedShipmentId(null);
        }}
        shipmentId={selectedShipmentId || undefined}
        onSuccess={() => {
          // Invalidate queries if needed, though navigation usually happens
        }}
      />
    </Card>
  );
}
