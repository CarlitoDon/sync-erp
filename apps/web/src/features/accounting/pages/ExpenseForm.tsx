import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/DatePicker';
import Select from '@/components/ui/Select';
import { formatCurrency } from '@/utils/format';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Card, CardContent } from '@/components/ui/Card';

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

export default function ExpenseForm() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  // Fetch partners (Vendors)
  // Assuming list returns all or we filter. Ideally filtering by isSupplier if available.
  const { data: partners = [] } = trpc.partner.list.useQuery(
    undefined,
    {
      enabled: !!currentCompany?.id,
    }
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
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
      navigate('/expenses');
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
    <PageContainer>
      <form onSubmit={handleSubmit(onSubmit)}>
        <PageHeader
          title="New Expense"
          description="Record a direct expense"
          actions={
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/expenses')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending
                  ? 'Saving...'
                  : 'Save Expense'}
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Main Form Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                      <span className="text-xs text-red-500">
                        Required
                      </span>
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
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardContent className="pt-6">
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
                          <div className="col-span-6">
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
                          <div className="col-span-2">
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
                          <div className="col-span-2">
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
                          <div className="col-span-2">
                            <Label>Amount</Label>
                            <div className="h-10 px-3 py-2 text-sm border border-transparent flex items-center justify-end font-medium">
                              {formatCurrency(
                                (watch(`items.${index}.quantity`) ||
                                  0) *
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
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Area (Totals) */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-medium text-gray-900">Summary</h3>
                <div className="flex justify-between items-center text-sm border-t pt-4">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-bold">
                    {formatCurrency(total)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Tax calculation is automatic based on settings
                  (currently 0% default).
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </PageContainer>
  );
}
