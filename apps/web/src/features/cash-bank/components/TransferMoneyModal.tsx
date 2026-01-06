import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useCashTransactions, useBankAccounts } from '../hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/Select';
import FormModal from '@/components/ui/FormModal';
import { CurrencyInput } from '@/components/ui';
import {
  CreateCashTransactionInput,
  CashTransactionTypeSchema,
} from '@sync-erp/shared';

// Browser-safe enum constant derived from Zod schema
const CashTransactionType = CashTransactionTypeSchema.enum;

interface TransferMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function TransferMoneyModal({
  isOpen,
  onClose,
  onSuccess,
}: TransferMoneyModalProps) {
  const { createTransaction, isCreating } = useCashTransactions();
  const { accounts: bankAccounts } = useBankAccounts();

  const { register, control, handleSubmit, watch, reset } =
    useForm<CreateCashTransactionInput>({
      defaultValues: {
        type: CashTransactionType.TRANSFER,
        date: new Date().toISOString().split('T')[0],
        reference: '',
        description: '',
        amount: 0,
        sourceBankAccountId: '',
        destinationBankAccountId: '',
      },
    });

  const watchAmount = watch('amount');

  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: CreateCashTransactionInput) => {
    const result = await createTransaction(data);
    if (result) {
      onSuccess?.();
      onClose();
    }
  };

  const bankAccountOptions = bankAccounts.map((acc) => ({
    value: acc.id,
    label: `${acc.bankName} (${acc.currency})`,
  }));

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer Funds"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <Controller
            name="sourceBankAccountId"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Select
                label="Transfer From *"
                value={field.value ?? ''}
                onChange={field.onChange}
                options={bankAccountOptions}
                placeholder="Select Source Account..."
              />
            )}
          />

          <Controller
            name="destinationBankAccountId"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Select
                label="Transfer To *"
                value={field.value ?? ''}
                onChange={field.onChange}
                options={bankAccountOptions}
                placeholder="Select Destination Account..."
              />
            )}
          />

          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              {...register('date', { required: true })}
            />
          </div>

          <div>
            <Label>Amount *</Label>
            <Controller
              name="amount"
              control={control}
              rules={{ required: true, min: 0.01 }}
              render={({ field: currencyField }) => (
                <CurrencyInput
                  value={currencyField.value ?? 0}
                  onChange={currencyField.onChange}
                  className="text-lg font-bold"
                />
              )}
            />
          </div>

          <div>
            <Label>Reference</Label>
            <Input
              {...register('reference')}
              placeholder="e.g. TRF-123"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Input
              {...register('description')}
              placeholder="Reason for transfer..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isCreating}
            disabled={Number(watchAmount) <= 0}
          >
            Save Draft
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
