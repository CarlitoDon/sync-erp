import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useCompany } from '@/contexts/CompanyContext';
import { useCashTransactions, useBankAccounts } from '../hooks';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/Select';
import FormModal from '@/components/ui/FormModal';
import { CurrencyInput } from '@/components/ui';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/format';
import { CreateCashTransactionInput } from '@sync-erp/shared';
import { CashTransactionTypeSchema } from '@sync-erp/shared';

// Browser-safe enum constant derived from Zod schema
const CashTransactionType = CashTransactionTypeSchema.enum;

interface SpendMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SpendMoneyModal({
  isOpen,
  onClose,
  onSuccess,
}: SpendMoneyModalProps) {
  const { currentCompany } = useCompany();
  const { createTransaction, isCreating } = useCashTransactions();
  const { accounts: bankAccounts } = useBankAccounts();

  // Fetch GL Accounts for expense allocation
  const { data: glAccounts = [] } =
    trpc.finance.listAccounts.useQuery(undefined, {
      enabled: !!currentCompany?.id && isOpen,
    });

  const { register, control, handleSubmit, watch, reset } =
    useForm<CreateCashTransactionInput>({
      defaultValues: {
        type: CashTransactionType.SPEND,
        date: new Date().toISOString().split('T')[0],
        reference: '',
        payee: '',
        description: '',
        items: [{ accountId: '', description: '', amount: 0 }],
      },
    });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchItems = watch('items');
  const totalAmount = (watchItems || []).reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );

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

  const expenseAccountOptions = glAccounts
    .filter((acc) => acc.isActive)
    .map((acc) => ({
      value: acc.id,
      label: `[${acc.code}] ${acc.name}`,
    }));

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Spend Money"
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Controller
              name="sourceBankAccountId"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Select
                  label="Paid From *"
                  value={field.value || ''}
                  onChange={field.onChange}
                  options={bankAccountOptions}
                  placeholder="Select Bank/Cash Account..."
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
              <Label>Payee</Label>
              <Input
                {...register('payee')}
                placeholder="Who are you paying?"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Reference</Label>
              <Input
                {...register('reference')}
                placeholder="e.g. INV-123, Receipt #..."
              />
            </div>

            <div>
              <Label>Description</Label>
              <Input
                {...register('description')}
                placeholder="What is this for?"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">
            Expense Allocation
          </Label>
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Account
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {fields.map((field, index) => (
                  <tr key={field.id}>
                    <td className="px-2 py-2">
                      <Controller
                        name={`items.${index}.accountId`}
                        control={control}
                        rules={{ required: true }}
                        render={({ field: selectField }) => (
                          <Select
                            value={selectField.value ?? ''}
                            onChange={selectField.onChange}
                            options={expenseAccountOptions}
                            placeholder="Select account..."
                            portal={false} // Avoid z-index issues inside modal
                          />
                        )}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        {...register(`items.${index}.description`)}
                        placeholder="Item description..."
                        className="h-9"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Controller
                        name={`items.${index}.amount`}
                        control={control}
                        render={({ field: currencyField }) => (
                          <CurrencyInput
                            value={currencyField.value ?? 0}
                            onChange={currencyField.onChange}
                            className="text-right h-9"
                          />
                        )}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-gray-400 hover:text-red-500 disabled:opacity-30"
                        disabled={fields.length <= 1}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-3 text-right font-bold text-gray-700"
                  >
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {formatCurrency(totalAmount)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button
            type="button"
            onClick={() =>
              append({ accountId: '', description: '', amount: 0 })
            }
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" /> Add Item
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isCreating}
            disabled={totalAmount <= 0}
          >
            Save Draft
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
