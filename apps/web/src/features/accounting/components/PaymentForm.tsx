import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { usePayment } from '@/features/accounting/hooks/usePayment';
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
import { DatePicker } from '@/components/ui/DatePicker';
import { PAYMENT_METHODS } from '@/types/api';

interface PaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  outstandingAmount: number;
  onSuccess?: () => void;
}

interface FormData {
  amount: number;
  method: (typeof PAYMENT_METHODS)[number];
  date: Date;
}

export function PaymentForm({
  isOpen,
  onClose,
  invoiceId,
  outstandingAmount,
  onSuccess,
}: PaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const { createPayment } = usePayment();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      amount: outstandingAmount,
      method: 'BANK_TRANSFER',
      date: new Date(),
    },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const result = await createPayment({
        invoiceId,
        amount: data.amount,
        method: data.method,
        businessDate: data.date,
      });

      if (result) {
        onSuccess?.();
        handleClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      reset();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            {/* Amount */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount *
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={outstandingAmount}
                className="col-span-3"
                {...register('amount', {
                  required: 'Amount is required',
                  min: {
                    value: 0.01,
                    message: 'Amount must be positive',
                  },
                  max: {
                    value: outstandingAmount,
                    message: `Cannot exceed outstanding amount (${outstandingAmount})`,
                  },
                  valueAsNumber: true,
                })}
              />
              {errors.amount && (
                <p className="col-span-4 text-sm text-red-600 text-right">
                  {errors.amount.message}
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="method" className="text-right">
                Method *
              </Label>
              <div className="col-span-3">
                <Controller
                  name="method"
                  control={control}
                  rules={{ required: 'Payment method is required' }}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onChange={field.onChange}
                      options={PAYMENT_METHODS.map((method) => ({
                        value: method,
                        label: method.replace(/_/g, ' '),
                      }))}
                      placeholder="Select payment method"
                    />
                  )}
                />
              </div>
            </div>

            {/* Date */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Date *
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
            <Button type="submit" isLoading={loading}>
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
