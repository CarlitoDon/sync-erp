import { DocumentList } from '@/features/accounting/components/DocumentList';

interface BillListProps {
  filter?: {
    partnerId?: string;
    orderId?: string;
  };
}

/**
 * Bill list component using shared DocumentList.
 * Refactored from ~486 lines to simple wrapper.
 */
export const BillList = ({ filter }: BillListProps) => {
  return <DocumentList type="bill" filter={filter} />;
};
