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

/**
 * Convert Date to yyyy-MM-dd string format required by HTML date input
 */
function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface CreateBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: string;
  grnId?: string;
  onSuccess?: (billId: string) => void;
}

// Form-specific type with string dates (HTML input compatible)
interface BillFormData {
  orderId: string;
  supplierInvoiceNumber?: string;
  dueDate?: string;
  taxRate?: number;
  businessDate?: string;
  paymentTermsString?: string;
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
    useForm<BillFormData>({
      defaultValues: {
        supplierInvoiceNumber: '',
        paymentTermsString: 'NET30',
        businessDate: toDateInputValue(new Date()), // Pre-fill today in yyyy-MM-dd format
      },
    });

  const businessDate = watch('businessDate');
  const paymentTermsString = watch('paymentTermsString');

  useEffect(() => {
    if (!isOpen) {
      reset();
      setPoId(null);
    } else {
      // Set default date to today when opening (in yyyy-MM-dd format)
      setValue('businessDate', toDateInputValue(new Date()));
    }
  }, [isOpen, reset, setValue]);

  // Pre-fill form from PO data
  useEffect(() => {
    if (order) {
      if (order.taxRate !== null && order.taxRate !== undefined) {
        setValue('taxRate', Number(order.taxRate));
      }
      // If PO has payment terms, use it
      if (order.paymentTerms) {
        setValue('paymentTermsString', order.paymentTerms);
      }
    }
  }, [order, setValue]);

  // Check if terms are strictly enforced (e.g. Upfront)
  const isUpfront = order?.paymentTerms === 'UPFRONT';

  useEffect(() => {
    if (businessDate && paymentTermsString) {
      // Ensure businessDate is a Date object for calculation
      // Parse as local time to avoid timezone shifts
      const dateObj = new Date(`${businessDate}T00:00:00`);
      if (!isNaN(dateObj.getTime())) {
        const calculated = calculateDueDate(
          dateObj,
          paymentTermsString
        );
        // Convert to yyyy-MM-dd format for HTML date input
        setValue('dueDate', toDateInputValue(calculated));
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

  const onSubmit = async (formData: BillFormData) => {
    // Convert form data to API format (string dates to Date objects)
    const apiData: CreateBillInput = {
      ...formData,
      businessDate: formData.businessDate
        ? new Date(formData.businessDate)
        : undefined,
      dueDate: formData.dueDate
        ? new Date(formData.dueDate)
        : undefined,
    };

    const result = await createFromPO(apiData);
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
                  disabled={isUpfront}
                  options={PAYMENT_TERMS.map((term) => ({
                    value: term.code,
                    label: term.label,
                  }))}
                />
              )}
            />
            {isUpfront && (
              <p className="text-xs text-amber-600 mt-1">
                Payment terms are locked to "Cash Upfront" as per
                Purchase Order.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bill Date *</Label>
              <Input
                type="date"
                {...register('businessDate', {
                  required: true,
                })}
                value={formatDateForInput(watch('businessDate'))}
              />
            </div>
            <div>
              <Label>Due Date (Auto-calculated)</Label>
              <Input
                type="date"
                {...register('dueDate')}
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
