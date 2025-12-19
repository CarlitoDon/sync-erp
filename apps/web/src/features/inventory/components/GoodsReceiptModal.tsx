import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useCompany } from '@/contexts/CompanyContext';
import { trpc } from '@/lib/trpc';
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
  items: { productId: string; quantity: number; unitCost: number }[];
}

export function GoodsReceiptModal({
  isOpen,
  onClose,
  purchaseOrderId,
  orderItems,
  onSuccess,
}: GoodsReceiptModalProps) {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<
    'confirm' | 'processing' | 'posted'
  >('confirm');

  const createMutation = trpc.inventory.createGRN.useMutation({
    onSuccess: () => utils.inventory.listGRN.invalidate(),
  });

  const postMutation = trpc.inventory.postGRN.useMutation({
    onSuccess: () => utils.inventory.listGRN.invalidate(),
  });

  // Pre-fill items from PO
  const defaultItems = orderItems.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitCost: item.price,
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

  const loading = createMutation.isPending || postMutation.isPending;

  const onSave = async (data: FormData, shouldPost: boolean) => {
    if (!currentCompany) return;
    setStep('processing');

    try {
      // Step 1: Create GRN
      const grn = await createMutation.mutateAsync({
        purchaseOrderId,
        notes: data.notes,
        date: data.date?.toISOString(),
        items: data.items.filter((item) => item.quantity > 0),
      });

      // Step 2: Post GRN (Stock IN) if requested
      if (shouldPost) {
        await postMutation.mutateAsync({ id: grn.id });
        setStep('posted');
      } else {
        // Just close if draft
        onSuccess?.();
        onClose();
        reset();
        setStep('confirm');
        return;
      }

      // Success toast shown by onSuccess callback
      onSuccess?.();
      setTimeout(() => {
        onClose();
        reset();
        setStep('confirm');
      }, 500);
    } catch (error) {
      setStep('confirm');
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
        <form className="space-y-4">
          <div className="grid gap-4 py-4">
            {/* Items List */}
            <div className="space-y-2">
              <Label>Items to Receive</Label>
              <div className="border rounded-md divide-y">
                {orderItems.map((item, index) => (
                  <div key={item.id} className="p-3">
                    <div className="flex items-start justify-between mb-2">
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
                      <div className="text-sm text-muted-foreground">
                        Ordered:{' '}
                        <span className="font-medium text-gray-900">
                          {item.quantity}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`qty-${index}`}
                        className="text-sm whitespace-nowrap"
                      >
                        Receive qty:
                      </Label>
                      <Input
                        id={`qty-${index}`}
                        type="number"
                        className="w-24"
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
                      <input
                        type="hidden"
                        {...register(`items.${index}.unitCost`, {
                          valueAsNumber: true,
                        })}
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
                Processing...
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

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSubmit((data) => onSave(data, false))}
                disabled={step !== 'confirm' || loading}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                onClick={handleSubmit((data) => onSave(data, true))}
                disabled={step !== 'confirm' || loading}
              >
                {loading ? 'Processing...' : 'Receive & Post'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
