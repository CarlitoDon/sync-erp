import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import Select from '@/components/ui/Select';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialProductId?: string;
}

interface StockAdjustmentFormData {
  productId: string;
  quantity: number;
  costPerUnit: number;
  reason: string;
}

export function StockAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  initialProductId,
}: StockAdjustmentModalProps) {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();
  /* eslint-disable @sync-erp/no-hardcoded-enum */
  const [adjustmentType, setAdjustmentType] = useState<
    'INCREMENT' | 'DECREMENT'
  >('INCREMENT');
  /* eslint-enable @sync-erp/no-hardcoded-enum */

  const adjustMutation = trpc.inventory.adjustStock.useMutation({
    onSuccess: () => {
      utils.inventory.getStockLevels.invalidate();
      utils.inventory.getMovements.invalidate();
      onSuccess?.();
      onClose();
      reset();
    },
  });

  const { register, handleSubmit, reset } =
    useForm<StockAdjustmentFormData>({
      defaultValues: {
        productId: initialProductId,
        quantity: 0,
        costPerUnit: 0,
        reason: '',
      },
    });

  const onSubmit = async (data: StockAdjustmentFormData) => {
    if (!currentCompany) return;

    await adjustMutation.mutateAsync({
      productId: data.productId,
      quantity:
        adjustmentType === 'DECREMENT'
          ? -Math.abs(data.quantity)
          : Math.abs(data.quantity),
      costPerUnit: Number(data.costPerUnit),
      reference: data.reason || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="productId" className="text-right">
                Product ID
              </Label>
              <Input
                id="productId"
                className="col-span-3"
                {...register('productId', { required: true })}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                Type
              </Label>
              <Select
                value={adjustmentType}
                onChange={(val) =>
                  // eslint-disable-next-line @sync-erp/no-hardcoded-enum
                  setAdjustmentType(val as 'INCREMENT' | 'DECREMENT')
                }
                options={[
                  { value: 'INCREMENT', label: 'Increment (+)' },
                  { value: 'DECREMENT', label: 'Decrement (-)' },
                ]}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                className="col-span-3"
                {...register('quantity', {
                  valueAsNumber: true,
                  required: true,
                  min: 1,
                })}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="costPerUnit" className="text-right">
                Unit Cost
              </Label>
              <Input
                id="costPerUnit"
                type="number"
                min="0"
                className="col-span-3"
                {...register('costPerUnit', {
                  valueAsNumber: true,
                  required: true,
                  min: 0,
                })}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reason" className="text-right">
                Reason
              </Label>
              <Input
                id="reason"
                className="col-span-3"
                placeholder="Optional reference"
                {...register('reason')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={adjustMutation.isPending}>
              {adjustMutation.isPending
                ? 'Adjusting...'
                : 'Confirm Adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
