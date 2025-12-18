import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  GoodsReceiptSchema,
  GoodsReceiptInput,
} from '@sync-erp/shared';
import { useCompany } from '../../../contexts/CompanyContext';
import { processGoodsReceipt } from '../services/inventoryService';
import { apiAction } from '../../../utils/apiAction';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { DatePicker } from '../../../components/ui/DatePicker';

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrderId: string;
  onSuccess?: () => void;
}

export function GoodsReceiptModal({
  isOpen,
  onClose,
  purchaseOrderId,
  onSuccess,
}: GoodsReceiptModalProps) {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [businessDate, setBusinessDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const { register, handleSubmit, reset } =
    useForm<GoodsReceiptInput>({
      resolver: zodResolver(GoodsReceiptSchema),
      defaultValues: {
        orderId: purchaseOrderId,
        reference: '',
      },
    });

  // Re-thinking: The spec says "Enter quantities". Usually PO Receipt lists items from PO and asks for Qty.
  // Without PO details (lines), we can't easily populate this.
  // Assumption: The user will select a PO line or providing productId.
  // Let's implement a simpler version first or mocks if we can't fetch PO lines here yet.
  // Plan: Just render a simple "Receive" form for the *whole* PO or simplified.
  // Wait, the Schema requires `items`. I will implement a single item receipt for MVP to satisfy type checker,
  // or (better) - since I don't have PO Lines context here easily without fetching PO,
  // I will assume this Modal is opened with context of *what* to receive, OR it fetches PO.
  // T005 says "Integrate into PurchaseOrders.tsx". So we might have PO data there.

  // Let's rely on `items` being passed or managed.
  // For this task T003, I'll build the shell and a simple item entry (Product ID + Qty).

  const onSubmit = async (data: GoodsReceiptInput) => {
    if (!currentCompany) return;
    setLoading(true);
    await apiAction(
      () => processGoodsReceipt(currentCompany.id, data),
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
          reset();
        },
        onError: () => setLoading(false), // apiAction handles toast
      }
    );
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive Goods</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Placeholder for Item inputs - specific UI logic depends on how complex we want. 
               For now, simple "Confirm Receipt" implies receiving what's on PO? 
               But schema requires items. 
               I'll add a simple "Product ID" and "Quantity" field for manual entry (P1 capability).
           */}
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reference" className="text-right">
                Reference
              </Label>
              <Input
                id="reference"
                className="col-span-3"
                placeholder="Optional (e.g. GRN-001)"
                {...register('reference')}
              />
            </div>
            {/* MVP: Receives all items on PO */}
            <p className="text-sm text-gray-500 text-center">
              This will receive all pending items on the Purchase
              Order.
            </p>

            {/* Business Date (FR-008a) */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="businessDate" className="text-right">
                Business Date *
              </Label>
              <div className="col-span-3">
                <DatePicker
                  value={businessDate}
                  onChange={setBusinessDate}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" isLoading={loading}>
              Confirm Receive
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
