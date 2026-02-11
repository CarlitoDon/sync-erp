import { useState, useMemo } from 'react';
import { trpc, RouterOutputs } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm, usePrompt } from '@/components/ui';
import {
  PaymentMethodType,
  InvoiceStatusFilter,
  defaultPaymentMethod,
  DOCUMENT_TYPES,
  DocumentType,
} from '@/features/accounting/utils/financeEnums';
import { InvoiceStatusSchema as StatusSchema } from '@/types/api';

type Bill = RouterOutputs['bill']['list'][number];
type Invoice = RouterOutputs['invoice']['list'][number];
export type Document = Bill | Invoice;

// Explicit return type to avoid TS2742 portability error with @trpc/react-query internals
interface UseDocumentListReturn {
  isBill: boolean;
  entityLabel: string;
  documents: Document[];
  filteredDocs: Document[];
  outstandingAmount: number;
  loading: boolean;
  filterStatus: InvoiceStatusFilter;
  setFilterStatus: (status: InvoiceStatusFilter) => void;
  selectedDoc: Document | null;
  paymentAmount: number;
  setPaymentAmount: (amount: number) => void;
  paymentMethod: PaymentMethodType;
  setPaymentMethod: (method: PaymentMethodType) => void;
  businessDate: string;
  setBusinessDate: (date: string) => void;
  showHistory: string | null;
  setShowHistory: (id: string | null) => void;
  handlePost: (id: string) => Promise<void>;
  handleVoid: (id: string) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  openPaymentModal: (doc: Document) => void;
  closePaymentModal: () => void;
  handlePayment: () => Promise<void>;
  paymentMutation: { isPending: boolean };
}

export function useDocumentList(
  type: DocumentType
): UseDocumentListReturn {
  const confirm = useConfirm();
  const prompt = usePrompt();
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  const isBill = type === DOCUMENT_TYPES.BILL;
  const entityLabel = isBill ? 'Bill' : 'Invoice';

  // Query based on type
  const billQuery = trpc.bill.list.useQuery(
    { status: undefined },
    { enabled: !!currentCompany?.id && isBill }
  );
  const invoiceQuery = trpc.invoice.list.useQuery(
    { status: undefined },
    { enabled: !!currentCompany?.id && !isBill }
  );

  const documents =
    (isBill ? billQuery.data : invoiceQuery.data) || [];
  const loading = isBill
    ? billQuery.isLoading
    : invoiceQuery.isLoading;

  // Mutations
  const postBillMutation = trpc.bill.post.useMutation({
    onSuccess: () => utils.bill.list.invalidate(),
  });
  const postInvoiceMutation = trpc.invoice.post.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });
  const voidBillMutation = trpc.bill.void.useMutation({
    onSuccess: () => utils.bill.list.invalidate(),
  });
  const voidInvoiceMutation = trpc.invoice.void.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });
  const deleteBillMutation = trpc.bill.delete.useMutation({
    onSuccess: () => utils.bill.list.invalidate(),
  });
  const paymentMutation = trpc.payment.create.useMutation({
    onSuccess: async () => {
      utils.bill.list.invalidate();
      utils.invoice.list.invalidate();
      utils.payment.list.invalidate();
      // Order status may change after payment (e.g., DP paid)
      utils.purchaseOrder.list.invalidate();
      utils.salesOrder.list.invalidate();
      // Ensure PO list cache updates even if not mounted
      await utils.purchaseOrder.list.refetch();
    },
  });

  const [filterStatus, setFilterStatus] =
    useState<InvoiceStatusFilter>('ALL');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(
    null
  );
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodType>(defaultPaymentMethod);
  const [businessDate, setBusinessDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [showHistory, setShowHistory] = useState<string | null>(null);

  // Memoize filtered docs and outstanding amount to avoid recalculation on every render
  const { filteredDocs, outstandingAmount } = useMemo(() => {
    const filtered = documents.filter(
      // eslint-disable-next-line @sync-erp/no-hardcoded-enum -- 'ALL' is a UI filter constant, not a database enum
      (d) => filterStatus === 'ALL' || d.status === filterStatus
    );
    const outstanding = documents
      .filter((d) => d.status === StatusSchema.enum.POSTED)
      .reduce((sum, d) => sum + Number(d.balance), 0);
    return { filteredDocs: filtered, outstandingAmount: outstanding };
  }, [documents, filterStatus]);

  const handlePost = async (id: string) => {
    await apiAction(
      () =>
        isBill
          ? postBillMutation.mutateAsync({ id })
          : postInvoiceMutation.mutateAsync({ id }),
      `${entityLabel} posted!`
    );
  };

  const handleVoid = async (id: string) => {
    // FR-024: Prompt for void reason (accessible modal)
    const reason = await prompt({
      title: `Void ${entityLabel}`,
      message: `Please enter a reason for voiding this ${entityLabel.toLowerCase()}:`,
      placeholder: 'Enter reason...',
      required: true,
    });
    if (!reason) {
      return; // User cancelled
    }

    const confirmed = await confirm({
      title: `Void ${entityLabel}`,
      message: `Are you sure you want to void this ${entityLabel.toLowerCase()}?`,
      confirmText: 'Yes, Void',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () =>
        isBill
          ? voidBillMutation.mutateAsync({ id, reason })
          : voidInvoiceMutation.mutateAsync({ id, reason }),
      `${entityLabel} voided`
    );
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: `Delete ${entityLabel}`,
      message: `Are you sure you want to delete this draft ${entityLabel.toLowerCase()}? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => deleteBillMutation.mutateAsync({ id }),
      `${entityLabel} deleted`
    );
  };

  const openPaymentModal = (doc: Document) => {
    setSelectedDoc(doc);
    setPaymentAmount(Number(doc.balance));
    setPaymentMethod(defaultPaymentMethod);
    setBusinessDate(new Date().toISOString().split('T')[0]);
  };

  const closePaymentModal = () => {
    setSelectedDoc(null);
    setPaymentAmount(0);
  };

  const handlePayment = async () => {
    if (
      !selectedDoc ||
      paymentAmount <= 0 ||
      paymentMutation.isPending
    )
      return;
    const result = await apiAction(
      () =>
        paymentMutation.mutateAsync({
          invoiceId: selectedDoc.id,
          amount: paymentAmount,
          method: paymentMethod,
          businessDate: new Date(businessDate),
          correlationId: crypto.randomUUID(),
        }),
      'Payment recorded!'
    );
    if (result) closePaymentModal();
  };

  return {
    isBill,
    entityLabel,
    documents,
    filteredDocs,
    outstandingAmount,
    loading,
    filterStatus,
    setFilterStatus,
    selectedDoc,
    paymentAmount,
    setPaymentAmount,
    paymentMethod,
    setPaymentMethod,
    businessDate,
    setBusinessDate,
    showHistory,
    setShowHistory,
    handlePost,
    handleVoid,
    handleDelete,
    openPaymentModal,
    closePaymentModal,
    handlePayment,
    paymentMutation,
  };
}
