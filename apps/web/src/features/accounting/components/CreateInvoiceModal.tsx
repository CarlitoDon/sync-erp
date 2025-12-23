import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useCompany } from '@/contexts/CompanyContext';
import {
  useInvoice,
  CreateInvoiceInput,
} from '@/features/accounting/hooks/useInvoice';
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

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: string;
  shipmentId?: string;
  onSuccess?: (invoiceId: string) => void;
}

// Form-specific type with string dates (HTML input compatible)
interface InvoiceFormData {
  orderId: string;
  dueDate?: string;
  taxRate?: number;
  businessDate?: string;
  paymentTermsString?: string;
}

export default function CreateInvoiceModal({
  isOpen,
  onClose,
  orderId,
  shipmentId,
  onSuccess,
}: CreateInvoiceModalProps) {
  const { currentCompany } = useCompany();
  const { createFromSO, loading: submitting } = useInvoice();
  const utils = trpc.useUtils();
  const [soId, setSoId] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch SO details to pre-fill defaults
  const { data: order } = trpc.salesOrder.getById.useQuery(
    { id: soId! },
    { enabled: !!soId && !!currentCompany?.id }
  );

  const { register, handleSubmit, setValue, watch, control, reset } =
    useForm<InvoiceFormData>({
      defaultValues: {
        paymentTermsString: 'NET30',
        businessDate: toDateInputValue(new Date()), // Pre-fill today in yyyy-MM-dd format
      },
    });

  const businessDate = watch('businessDate');
  const paymentTermsString = watch('paymentTermsString');

  useEffect(() => {
    if (!isOpen) {
      reset();
      setSoId(null);
    } else {
      // Set default date to today when opening (in yyyy-MM-dd format)
      setValue('businessDate', toDateInputValue(new Date()));
    }
  }, [isOpen, reset, setValue]);

  // Pre-fill form from SO data
  useEffect(() => {
    if (order) {
      if (order.taxRate !== null && order.taxRate !== undefined) {
        setValue('taxRate', Number(order.taxRate));
      }
      // If SO has payment terms, we could set them here.
      // Default to NET30 for now.
    }
  }, [order, setValue]);

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

  // Load SO ID from props or Shipment
  useEffect(() => {
    async function loadData() {
      if (!currentCompany || !isOpen) return;

      if (orderId) {
        setSoId(orderId);
        setValue('orderId', orderId);
      } else if (shipmentId) {
        setLoadingDetails(true);
        try {
          const shipment = await utils.inventory.getShipment.fetch({
            id: shipmentId,
          });
          if (shipment) {
            setSoId(shipment.salesOrderId);
            setValue('orderId', shipment.salesOrderId);
          }
        } finally {
          setLoadingDetails(false);
        }
      }
    }
    loadData();
  }, [currentCompany, shipmentId, orderId, isOpen, setValue, utils]);

  const onSubmit = async (formData: InvoiceFormData) => {
    // Convert form data to API format (string dates to Date objects)
    const apiData: CreateInvoiceInput = {
      ...formData,
      businessDate: formData.businessDate
        ? new Date(formData.businessDate)
        : undefined,
      dueDate: formData.dueDate
        ? new Date(formData.dueDate)
        : undefined,
    };

    const result = await createFromSO(apiData);
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
      title="Create Invoice"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Hidden Order ID */}
        <input type="hidden" {...register('orderId')} />

        {(loadingDetails || (soId && !order)) && (
          <p className="text-sm text-gray-500">Loading details...</p>
        )}

        <div className="grid gap-4">
          {/* Tax Rate inherited from SO - no input needed */}

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
              <Label>Invoice Date *</Label>
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
            disabled={submitting || (!soId && !loadingDetails)}
          >
            {submitting ? 'Creating...' : 'Create Invoice'}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
