import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { StockAdjustmentInput } from '@sync-erp/shared';
import { useCompany } from '../../../contexts/CompanyContext';
import { adjustStock } from '../services/inventoryService';
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
  const [loading, setLoading] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<
    'INCREMENT' | 'DECREMENT'
  >('INCREMENT');

  const { register, handleSubmit, reset } =
    useForm<StockAdjustmentFormData>({
      // Use any for form, map to StockAdjustmentInput on submit
      resolver: undefined, // Manual validation or simple Zod schema local
      defaultValues: {
        productId: initialProductId,
        quantity: 0,
        costPerUnit: 0,
        reason: '',
      },
    });

  const onSubmit = async (data: StockAdjustmentFormData) => {
    if (!currentCompany) return;

    // Transform data to StockAdjustmentInput
    const payload: StockAdjustmentInput = {
      productId: data.productId,
      quantity:
        adjustmentType === 'DECREMENT'
          ? -Math.abs(data.quantity)
          : Math.abs(data.quantity),
      costPerUnit: Number(data.costPerUnit),
      reference: data.reason,
    };

    setLoading(true);
    await apiAction(() => adjustStock(currentCompany.id, payload), {
      onSuccess: () => {
        onSuccess?.();
        onClose();
        reset();
      },
      onError: () => setLoading(false),
    });
    setLoading(false);
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
              <select
                id="type"
                className="col-span-3 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={adjustmentType}
                onChange={(e) =>
                  setAdjustmentType(
                    e.target.value as 'INCREMENT' | 'DECREMENT'
                  )
                }
              >
                <option value="INCREMENT">Increment (+)</option>
                <option value="DECREMENT">Decrement (-)</option>
              </select>
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
            <Button type="submit" disabled={loading}>
              {loading ? 'Adjusting...' : 'Confirm Adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
