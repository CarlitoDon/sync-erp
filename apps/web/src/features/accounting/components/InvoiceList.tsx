import { DocumentList } from '@/features/accounting/components/DocumentList';

interface InvoiceListProps {
  filter?: {
    partnerId?: string;
    orderId?: string;
  };
}

/**
 * Invoice list component using shared DocumentList.
 * Refactored from ~498 lines to simple wrapper.
 */
export const InvoiceList = ({ filter }: InvoiceListProps) => {
  return <DocumentList type="invoice" filter={filter} />;
};
