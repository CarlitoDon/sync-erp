import FormModal from '@/components/ui/FormModal';
import { PaymentHistoryList } from './PaymentHistoryList';

interface PaymentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  totalAmount: number;
  currency?: string;
}

export function PaymentHistoryModal({
  isOpen,
  onClose,
  invoiceId,
  totalAmount,
  currency = 'IDR',
}: PaymentHistoryModalProps) {
  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Payment History"
      maxWidth="4xl"
    >
      <PaymentHistoryList
        invoiceId={invoiceId}
        totalAmount={totalAmount}
        currency={currency}
      />
    </FormModal>
  );
}
