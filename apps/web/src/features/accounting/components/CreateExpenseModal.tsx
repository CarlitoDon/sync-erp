import { useForm, useFieldArray } from 'react-hook-form';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/DatePicker';
import Select from '@/components/ui/Select';
import { formatCurrency } from '@/utils/format';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import FormModal from '@/components/ui/FormModal';
import { toast } from 'react-hot-toast';

interface ExpenseFormData {
  partnerId: string;
  date: string; // YYYY-MM-DD
  dueDate?: string;
  reference?: string;
  items: {
    description: string;
    quantity: number;
    price: number;
  }[];
}

interface CreateExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateExpenseModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateExpenseModalProps) {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  // Fetch partners (Vendors)
  const { data: partners = [] } = trpc.partner.list.useQuery(
    undefined,
    {
      enabled: !!currentCompany?.id && isOpen,
    }
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      items: [{ description: '', quantity: 1, price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const createMutation = trpc.expense.create.useMutation({
    onSuccess: () => {
      utils.expense.list.invalidate();
      toast.success('Expense recorded successfully');
      onSuccess?.();
      onClose();
      reset();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to record expense');
    },
  });

  const onSubmit = (data: ExpenseFormData) => {
    createMutation.mutate({
      partnerId: data.partnerId,
      date: new Date(data.date),
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      reference: data.reference,
      items: data.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        price: Number(item.price),
      })),
    });
  };

  const partnerOptions = partners.map((p) => ({
    label: p.name,
    value: p.id,
  }));

  // Watch items for total calculation
  const items = watch('items');
  const total = items.reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0) * Number(item.price || 0),
    0
  );

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="New Expense"
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Select
              label="Payee (Vendor)"
              value={watch('partnerId') || ''}
              onChange={(val) => setValue('partnerId', val)}
              options={partnerOptions}
              placeholder="Select Payee"
              required
            />
            {errors.partnerId && (
              <span className="text-xs text-red-500">Required</span>
            )}
          </div>
          <div>
            <Label>Reference (Optional)</Label>
            <Input
              {...register('reference')}
              placeholder="e.g. Receipt #123"
            />
          </div>
          <div>
            <DatePicker
              label="Date"
              value={watch('date')}
              onChange={(val) => setValue('date', val)}
              required
            />
          </div>
          <div>
            <DatePicker
              label="Due Date"
              value={watch('dueDate') || ''}
              onChange={(val) => setValue('dueDate', val)}
            />
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Expense Items
            </h3>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-6">
                      <Label>Description</Label>
                      <Input
                        {...register(
                          `items.${index}.description` as const,
                          { required: true }
                        )}
                        placeholder="Description"
                      />
                      {errors.items?.[index]?.description && (
                        <span className="text-xs text-red-500">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        {...register(
                          `items.${index}.quantity` as const,
                          {
                            required: true,
                            valueAsNumber: true,
                          }
                        )}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Label>Price</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...register(
                          `items.${index}.price` as const,
                          {
                            required: true,
                            valueAsNumber: true,
                          }
                        )}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Label>Amount</Label>
                      <div className="h-10 px-3 py-2 text-sm border border-transparent flex items-center justify-end font-medium">
                        {formatCurrency(
                          (watch(`items.${index}.quantity`) || 0) *
                            (watch(`items.${index}.price`) || 0)
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="mt-8 p-1 text-gray-400 hover:text-red-500"
                  title="Remove Item"
                  disabled={fields.length <= 1}
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({
                  description: '',
                  quantity: 1,
                  price: 0,
                })
              }
              className="w-full sm:w-auto"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center border-t pt-4">
          <div className="text-sm text-gray-500">
            Tax calculation is automatic based on settings.
          </div>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <span className="font-medium">Total</span>
            <span className="text-xl font-bold">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Saving...' : 'Save Expense'}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
