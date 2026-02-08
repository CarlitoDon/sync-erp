/**
 * usePurchaseOrderActions
 *
 * Manages purchase order mutations and action handlers.
 * Extracted from PurchaseOrderDetail.tsx to reduce component complexity.
 */
import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { usePrompt } from '@/components/ui';

interface UsePurchaseOrderActionsOptions {
  orderId: string;
}

export function usePurchaseOrderActions({
  orderId,
}: UsePurchaseOrderActionsOptions) {
  const prompt = usePrompt();
  const utils = trpc.useUtils();

  // Modal states
  const [goodsReceiptId, setGoodsReceiptId] = useState<string | null>(
    null
  );
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isDpBillModalOpen, setIsDpBillModalOpen] = useState(false);
  const [selectedFulfillmentId, setSelectedFulfillmentId] = useState<
    string | null
  >(null);

  // Mutations
  const closeMutation = trpc.purchaseOrder.close.useMutation({
    onSuccess: () => {
      utils.purchaseOrder.getById.invalidate({ id: orderId });
    },
  });

  // Handlers
  const handleCreateBill = useCallback(() => {
    setIsBillModalOpen(true);
  }, []);

  const handleCreateDpBill = useCallback(() => {
    setIsDpBillModalOpen(true);
  }, []);

  const handleClosePO = useCallback(async () => {
    const reason = await prompt({
      title: 'Close Purchase Order',
      message: 'Please enter a reason for closing this PO:',
      placeholder: 'e.g., Supplier unable to fulfill remaining items',
      required: true,
      submitText: 'Close PO',
    });

    if (reason) {
      await closeMutation.mutateAsync({
        id: orderId,
        reason: reason.trim(),
      });
    }
  }, [orderId, prompt, closeMutation]);

  const handleReceiveGoods = useCallback((id: string) => {
    setGoodsReceiptId(id);
  }, []);

  return {
    // Loading states
    isClosing: closeMutation.isPending,

    // Handlers
    handleCreateBill,
    handleCreateDpBill,
    handleClosePO,
    handleReceiveGoods,

    // Goods Receipt Modal
    goodsReceiptModal: {
      isOpen: goodsReceiptId !== null,
      id: goodsReceiptId,
      close: () => setGoodsReceiptId(null),
      onSuccess: () => {
        setGoodsReceiptId(null);
        utils.purchaseOrder.getById.invalidate({ id: orderId });
      },
    },

    // Bill Modal
    billModal: {
      isOpen: isBillModalOpen,
      selectedFulfillmentId,
      // Helper to open bill modal pre-filled with specific fulfillment
      openWithFulfillment: (fulfillmentId: string) => {
        setSelectedFulfillmentId(fulfillmentId);
        setIsBillModalOpen(true);
      },
      close: () => {
        setIsBillModalOpen(false);
        setSelectedFulfillmentId(null);
      },
      onSuccess: () => {
        utils.purchaseOrder.getById.invalidate({ id: orderId });
      },
    },

    // DP Bill Modal
    dpBillModal: {
      isOpen: isDpBillModalOpen,
      close: () => setIsDpBillModalOpen(false),
      onSuccess: () => {
        utils.purchaseOrder.getById.invalidate({ id: orderId });
      },
    },
  };
}
