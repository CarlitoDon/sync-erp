import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useCompany } from '@/contexts/CompanyContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'react-hot-toast';
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

interface ShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesOrderId: string;
  orderItems: OrderItem[];
  onSuccess?: () => void;
}

interface FormData {
  notes?: string;
  date?: Date;
  items: { productId: string; quantity: number }[];
}

export function ShipmentModal({
  isOpen,
  onClose,
  salesOrderId,
  orderItems,
  onSuccess,
}: ShipmentModalProps) {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();
  /* eslint-disable @sync-erp/no-hardcoded-enum */
  const [step, setStep] = useState<
    'confirm' | 'processing' | 'shipped'
  >('confirm');
  /* eslint-enable @sync-erp/no-hardcoded-enum */

  // Fetch already shipped quantities
  const { data: shippedData } =
    trpc.salesOrder.getShippedQuantities.useQuery(
      { orderId: salesOrderId },
      { enabled: isOpen && !!salesOrderId }
    );

  // Convert to Map for easy lookup - memoized to prevent infinite loop
  const shippedMap = React.useMemo(
    () => new Map<string, number>(shippedData || []),
    [shippedData]
  );

  const createMutation = trpc.inventory.createShipment.useMutation({
    onSuccess: () => utils.inventory.listShipments.invalidate(),
  });

  const postMutation = trpc.inventory.postShipment.useMutation({
    onSuccess: () => utils.inventory.listShipments.invalidate(),
  });

  // Pre-fill items with remaining qty (ordered - shipped)
  const defaultItems = React.useMemo(
    () =>
      orderItems.map((item) => {
        const shipped = shippedMap.get(item.productId) || 0;
        const remaining = Math.max(0, item.quantity - shipped);
        return {
          productId: item.productId,
          quantity: remaining,
        };
      }),
    [orderItems, shippedMap]
  );

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

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen && shippedData !== undefined) {
      const items = orderItems.map((item) => {
        const shipped =
          new Map<string, number>(shippedData || []).get(
            item.productId
          ) || 0;
        const remaining = Math.max(0, item.quantity - shipped);
        return {
          productId: item.productId,
          quantity: remaining,
        };
      });
      reset({ notes: '', date: new Date(), items });
    }
  }, [isOpen, salesOrderId, shippedData, orderItems, reset]);

  const loading = createMutation.isPending || postMutation.isPending;

  const onSave = async (data: FormData, shouldPost: boolean) => {
    if (!currentCompany) return;
    setStep('processing');

    try {
      // Step 1: Create Shipment
      const shipment = await createMutation.mutateAsync({
        salesOrderId,
        notes: data.notes,
        date: data.date?.toISOString(),
        items: data.items.filter((item) => item.quantity > 0),
      });

      // Step 2: Post Shipment (Stock OUT) if requested
      if (shouldPost) {
        await postMutation.mutateAsync({ id: shipment.id });
        setStep('shipped');
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
    } catch (error: unknown) {
      setStep('confirm');
      // Show error toast with message from backend
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to ship goods';
      toast.error(message);
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
          <DialogTitle>Ship Goods</DialogTitle>
        </DialogHeader>
        <form className="space-y-4">
          <div className="grid gap-4 py-4">
            {/* Items List */}
            <div className="space-y-2">
              <Label>Items to Ship</Label>
              <div className="border rounded-md divide-y">
                {orderItems.map((item, index) => {
                  const shipped = shippedMap.get(item.productId) || 0;
                  const remaining = Math.max(
                    0,
                    item.quantity - shipped
                  );
                  const isFullyShipped = remaining === 0;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 ${isFullyShipped ? 'bg-green-50' : ''}`}
                    >
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
                        <div className="text-right text-sm">
                          <div className="text-muted-foreground">
                            Ordered:{' '}
                            <span className="font-medium text-gray-900">
                              {item.quantity}
                            </span>
                          </div>
                          <div className="text-muted-foreground">
                            Shipped:{' '}
                            <span className="font-medium text-blue-600">
                              {shipped}
                            </span>
                          </div>
                          <div
                            className={`font-medium ${isFullyShipped ? 'text-green-600' : 'text-amber-600'}`}
                          >
                            {isFullyShipped
                              ? '✓ Complete'
                              : `Remaining: ${remaining}`}
                          </div>
                        </div>
                      </div>
                      {!isFullyShipped && (
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={`qty-${index}`}
                            className="text-sm whitespace-nowrap"
                          >
                            Ship qty:
                          </Label>
                          <Input
                            id={`qty-${index}`}
                            type="number"
                            className="w-24"
                            min={0}
                            max={remaining}
                            {...register(`items.${index}.quantity`, {
                              valueAsNumber: true,
                              max: remaining,
                            })}
                          />
                          <input
                            type="hidden"
                            {...register(`items.${index}.productId`)}
                          />
                        </div>
                      )}
                      {isFullyShipped && (
                        <>
                          <input
                            type="hidden"
                            value={0}
                            {...register(`items.${index}.quantity`, {
                              valueAsNumber: true,
                            })}
                          />
                          <input
                            type="hidden"
                            {...register(`items.${index}.productId`)}
                          />
                        </>
                      )}
                    </div>
                  );
                })}
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
            {step === 'shipped' && (
              <p className="text-sm text-green-600 text-center">
                ✓ Goods shipped successfully!
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
                {loading ? 'Processing...' : 'Ship & Post'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
