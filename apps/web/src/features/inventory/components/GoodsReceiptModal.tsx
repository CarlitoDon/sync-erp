import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useCompany } from '@/contexts/CompanyContext';
import {
  createGoodsReceipt,
  postGoodsReceipt,
  CreateGoodsReceiptInput,
} from '@/features/inventory/services/inventoryService';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/DatePicker';

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product?: { name: string; sku?: string };
}

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrderId: string;
  orderItems: OrderItem[];
  onSuccess?: () => void;
}

interface FormData {
  notes?: string;
  date?: Date;
  items: { productId: string; quantity: number }[];
}

export function GoodsReceiptModal({
  isOpen,
  onClose,
  purchaseOrderId,
  orderItems,
  onSuccess,
}: GoodsReceiptModalProps) {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<
    'confirm' | 'processing' | 'posted'
  >('confirm');

  // Pre-fill items from PO
  const defaultItems = orderItems.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
  }));

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      notes: '',
      date: new Date(),
      items: defaultItems,
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!currentCompany) return;
    setLoading(true);
    setStep('processing');

    try {
      // Step 1: Create GRN
      const grnInput: CreateGoodsReceiptInput = {
        purchaseOrderId,
        notes: data.notes,
        date: data.date?.toISOString(),
        items: data.items.filter((item) => item.quantity > 0),
      };

      const grn = await createGoodsReceipt(
        currentCompany.id,
        grnInput
      );

      // Step 2: Post GRN (Stock IN)
      await postGoodsReceipt(currentCompany.id, grn.id);

      setStep('posted');

      // Success toast shown by onSuccess callback

      onSuccess?.();
      setTimeout(() => {
        onClose();
        reset();
        setStep('confirm');
      }, 500);
    } catch (error) {
      setStep('confirm');
      // Error toast handled by apiAction in service
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      reset();
      setStep('confirm');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive Goods</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            {/* Items List */}
            <div className="space-y-2">
              <Label>Items to Receive</Label>
              <div className="border rounded-md divide-y">
                {orderItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="flex-1">
                      <p className="font-medium">
                        {item.product?.name || item.productId}
                      </p>
                      {item.product?.sku && (
                        <p className="text-sm text-muted-foreground">
                          SKU: {item.product.sku}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Ordered: {item.quantity}
                      </span>
                      <Input
                        type="number"
                        className="w-20"
                        min={0}
                        max={item.quantity}
                        {...register(`items.${index}.quantity`, {
                          valueAsNumber: true,
                        })}
                      />
                      <input
                        type="hidden"
                        {...register(`items.${index}.productId`)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <Input
                id="notes"
                className="col-span-3"
                placeholder="Optional notes"
                {...register('notes')}
              />
            </div>

            {/* Business Date */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Date
              </Label>
              <div className="col-span-3">
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      value={
                        field.value
                          ? new Date(field.value)
                              .toISOString()
                              .split('T')[0]
                          : ''
                      }
                      onChange={(date) => field.onChange(date)}
                    />
                  )}
                />
              </div>
            </div>

            {/* Status Message */}
            {step === 'processing' && (
              <p className="text-sm text-blue-600 text-center animate-pulse">
                Creating receipt and updating stock...
              </p>
            )}
            {step === 'posted' && (
              <p className="text-sm text-green-600 text-center">
                ✓ Goods received successfully!
              </p>
            )}

            {Object.keys(errors).length > 0 && (
              <div className="text-red-500 text-sm text-center">
                Please check the form for errors.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={loading}
              disabled={step !== 'confirm'}
            >
              {step === 'confirm' ? 'Receive All' : 'Processing...'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
