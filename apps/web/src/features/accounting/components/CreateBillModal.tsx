import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useCompany } from '@/contexts/CompanyContext';
import {
  useBill,
  CreateBillInput,
} from '@/features/accounting/hooks/useBill';
import { useGoodsReceipt } from '@/features/procurement/hooks/useGoodsReceipt';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/Select';
import FormModal from '@/components/ui/FormModal';
import { PAYMENT_TERMS, calculateDueDate } from '@/types/api';

interface CreateBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: string;
  grnId?: string;
  onSuccess?: (billId: string) => void;
}

// Tax Rate is inherited from PO, no need to input here

export default function CreateBillModal({
  isOpen,
  onClose,
  orderId,
  grnId,
  onSuccess,
}: CreateBillModalProps) {
  const { currentCompany } = useCompany();
  const { createFromPO, loading: submitting } = useBill();
  const { getReceipt } = useGoodsReceipt();
  const [poId, setPoId] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch PO details to pre-fill defaults
  const { data: order } = trpc.purchaseOrder.getById.useQuery(
    { id: poId! },
    { enabled: !!poId && !!currentCompany?.id }
  );

  const { register, handleSubmit, setValue, watch, control, reset } =
    useForm<CreateBillInput>({
      defaultValues: {
        supplierInvoiceNumber: '',
        paymentTermsString: 'NET30',
        businessDate: new Date(), // Pre-fill today
      },
    });

  const businessDate = watch('businessDate');
  const paymentTermsString = watch('paymentTermsString');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      reset();
      setPoId(null);
    } else {
      // Set default date to today when opening
      setValue('businessDate', new Date());
    }
  }, [isOpen, reset, setValue]);

  // Pre-fill form from PO data
  useEffect(() => {
    if (order) {
      if (order.taxRate !== null && order.taxRate !== undefined) {
        setValue('taxRate', Number(order.taxRate));
      }
      // If PO has payment terms (assuming it might be stored, if not default to NET30)
      // Currently PO schema might not directly expose paymentTerms string cleanly or it's on partner.
      // For now we default to NET30 or keep what user selected.
      // If we wanted to fetch from Partner, we'd need partner data.
    }
  }, [order, setValue]);

  // Auto-calculate dueDate when businessDate or payment terms change
  useEffect(() => {
    if (businessDate && paymentTermsString) {
      // Ensure businessDate is a Date object for calculation
      const dateObj = new Date(businessDate);
      if (!isNaN(dateObj.getTime())) {
        const calculated = calculateDueDate(
          dateObj,
          paymentTermsString
        );
        setValue('dueDate', calculated);
      }
    }
  }, [businessDate, paymentTermsString, setValue]);

  // Load PO ID from props or GRN
  useEffect(() => {
    async function loadData() {
      if (!currentCompany || !isOpen) return;

      if (orderId) {
        setPoId(orderId);
        setValue('orderId', orderId);
      } else if (grnId) {
        setLoadingDetails(true);
        try {
          const grn = await getReceipt(grnId);
          if (grn) {
            setPoId(grn.purchaseOrderId);
            setValue('orderId', grn.purchaseOrderId);
          }
        } finally {
          setLoadingDetails(false);
        }
      }
    }
    loadData();
  }, [currentCompany, grnId, orderId, isOpen, setValue, getReceipt]);

  const onSubmit = async (data: CreateBillInput) => {
    const result = await createFromPO(data);
    if (result) {
      onSuccess?.(result.id);
      onClose();
    }
  };

  // Helper to format date for input
  const formatDateForInput = (date: Date | string | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Bill"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Hidden Order ID */}
        <input type="hidden" {...register('orderId')} />

        {(loadingDetails || (poId && !order)) && (
          <p className="text-sm text-gray-500">Loading details...</p>
        )}

        <div className="grid gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Label className="mb-0">
                Supplier Invoice Ref (Optional)
              </Label>
              <div className="group relative">
                <span className="flex items-center justify-center w-4 h-4 text-xs text-gray-500 bg-gray-200 rounded-full cursor-help hover:bg-gray-300 transition-colors">
                  ?
                </span>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-56 z-50">
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                  Nomor faktur/invoice dari supplier Anda. Field ini
                  opsional untuk referensi. Bill Number akan
                  di-generate otomatis.
                </div>
              </div>
            </div>
            <Input
              {...register('supplierInvoiceNumber')}
              placeholder="e.g. FKT/2024/001"
              autoFocus
            />
          </div>

          {/* Tax Rate inherited from PO - no input needed */}

          <div>
            <Label>Payment Terms</Label>
            <Controller
              name="paymentTermsString"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? 'NET30'}
                  onChange={field.onChange}
                  options={PAYMENT_TERMS.map((term) => ({
                    value: term.code,
                    label: term.label,
                  }))}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bill Date *</Label>
              <Input
                type="date"
                {...register('businessDate', {
                  valueAsDate: true,
                  required: true,
                })}
                value={formatDateForInput(watch('businessDate'))}
              />
            </div>
            <div>
              <Label>Due Date (Auto-calculated)</Label>
              <Input
                type="date"
                {...register('dueDate', { valueAsDate: true })}
                disabled
                className="bg-gray-50"
                value={formatDateForInput(watch('dueDate'))}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t mt-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || (!poId && !loadingDetails)}
          >
            {submitting ? 'Creating...' : 'Create Bill'}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
