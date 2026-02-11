import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useCompany } from '@/contexts/CompanyContext';
import {
  useBill,
  CreateBillInput,
} from '@/features/accounting/hooks/useBill';
import { formatCurrency } from '@/utils/format';
import { useGoodsReceipt } from '@/features/procurement/hooks/useGoodsReceipt';
import { trpc } from '@/lib/trpc';
import {
  PaymentTermsSchema,
  InvoiceStatusSchema,
  InvoiceTypeSchema,
} from '@sync-erp/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import FormModal from '@/components/ui/FormModal';
import { calculateDueDate } from '@/types/api';

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
  fulfillmentId?: string; // Feature 041: Renamed from grnId
  onSuccess?: (billId: string) => void;
}

// Form-specific type with string dates (HTML input compatible)
interface BillFormData {
  orderId: string;
  fulfillmentId?: string; // Feature 041: Renamed from grnId
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
  fulfillmentId, // Feature 041: Renamed from grnId
  onSuccess,
}: CreateBillModalProps) {
  const { currentCompany } = useCompany();
  const { createFromPO, isCreating } = useBill();
  const { getReceipt } = useGoodsReceipt();
  const [poId, setPoId] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch PO details to pre-fill defaults
  const { data: order } = trpc.purchaseOrder.getById.useQuery(
    { id: poId! },
    { enabled: !!poId && !!currentCompany?.id }
  );

  // Fetch GRN details if fulfillmentId is present (Feature 041 - Enhanced UX)
  const { data: grn } = trpc.inventory.getGRN.useQuery(
    { id: fulfillmentId! },
    { enabled: !!fulfillmentId && !!currentCompany?.id }
  );

  const { register, handleSubmit, setValue, watch, reset } =
    useForm<BillFormData>({
      defaultValues: {
        supplierInvoiceNumber: '',
        paymentTermsString: PaymentTermsSchema.enum.NET30,
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

      // Feature 041: If both orderId and fulfillmentId provided, set both
      if (orderId) {
        setPoId(orderId);
        setValue('orderId', orderId);
        // Also set fulfillmentId if provided (from GRN table Create Bill button)
        if (fulfillmentId) {
          setValue('fulfillmentId', fulfillmentId);
        }
      } else if (fulfillmentId) {
        // Only fulfillmentId provided - lookup orderId from GRN
        setLoadingDetails(true);
        try {
          const grn = await getReceipt(fulfillmentId);
          if (grn) {
            setPoId(grn.orderId);
            setValue('orderId', grn.orderId);
            setValue('fulfillmentId', fulfillmentId);
          }
        } finally {
          setLoadingDetails(false);
        }
      }
    }
    loadData();
  }, [
    currentCompany,
    fulfillmentId,
    orderId,
    isOpen,
    setValue,
    getReceipt,
  ]);

  const onSubmit = async (formData: BillFormData) => {
    // Convert form data to API format (string dates to Date objects)
    const apiData: CreateBillInput = {
      orderId: formData.orderId,
      fulfillmentId: formData.fulfillmentId || undefined, // Feature 041: Only include if set
      supplierInvoiceNumber:
        formData.supplierInvoiceNumber || undefined,
      businessDate: formData.businessDate
        ? new Date(formData.businessDate)
        : undefined,
      dueDate: formData.dueDate
        ? new Date(formData.dueDate)
        : undefined,
      taxRate: formData.taxRate,
      paymentTermsString: formData.paymentTermsString,
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

  // Billing Summary Calculation
  const isGrnBill = !!fulfillmentId;
  const sourceNumber = isGrnBill ? grn?.number : order?.orderNumber;
  const poNumber = order?.orderNumber;
  const sourceLabel = isGrnBill ? 'Goods Receipt' : 'Purchase Order';

  // Calculate items and total
  const itemsToBill = isGrnBill
    ? grn?.items.map((item) => ({
        productName: item.product.name,
        qty: Number(item.quantity),
        price: Number(item.orderItem?.price || 0),
        total:
          Number(item.quantity) * Number(item.orderItem?.price || 0),
      })) || []
    : order?.items.map((item) => ({
        productName: item.product.name,
        qty: Number(item.quantity),
        price: Number(item.price || 0),
        total: Number(item.quantity) * Number(item.price || 0),
      })) || [];

  const subtotal = itemsToBill.reduce(
    (sum, item) => sum + item.total,
    0
  );
  const taxRate = Number(order?.taxRate || 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const totalAmount = subtotal + taxAmount;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Bill"
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Billing Summary Section */}
        {(order || grn) && (
          <div className="bg-slate-50 border rounded-lg p-6 mb-6 text-sm">
            {/* Header / Context */}
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <div>
                <div className="font-semibold text-slate-800">
                  Transaction Analysis
                </div>
                <div className="text-slate-500 text-xs">
                  {sourceLabel} <strong>{sourceNumber}</strong> • PO{' '}
                  <strong>{poNumber}</strong>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 uppercase tracking-wider">
                  PO Total
                </div>
                <div className="font-bold text-slate-900">
                  {formatCurrency(Number(order?.totalAmount || 0))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* 1. Previous History */}
              <div className="space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Previously Billed</span>
                  <span className="font-medium">
                    {formatCurrency(
                      Number(order?.computed?.totalBilled || 0)
                    )}
                  </span>
                </div>
                {/* List of Previous Bills */}
                {order?.invoices && order.invoices.length > 0 && (
                  <div className="pl-3 border-l-2 border-slate-200 space-y-1 my-1">
                    {order.invoices
                      .filter(
                        (inv) =>
                          inv.status !==
                            InvoiceStatusSchema.enum.VOID &&
                          inv.type === InvoiceTypeSchema.enum.BILL
                      )
                      .map((inv) => (
                        <div
                          key={inv.id}
                          className="flex justify-between text-xs text-slate-500"
                        >
                          <span>
                            {inv.invoiceNumber} ({inv.status})
                          </span>
                          <span>
                            {formatCurrency(Number(inv.amount))}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
                <div className="flex justify-between text-slate-600 border-t border-dashed pt-2">
                  <span>Current Outstanding</span>
                  <span className="font-medium">
                    {formatCurrency(
                      Number(order?.computed?.outstanding || 0)
                    )}
                  </span>
                </div>
              </div>

              {/* 2. This Bill impact */}
              <div className="bg-white border rounded p-3 space-y-2 shadow-sm">
                <div className="font-semibold text-slate-800 border-b pb-1 mb-2 text-xs uppercase tracking-wider">
                  Current Bill (Draft)
                </div>
                {/* Items List (Brief) */}
                <div className="text-xs text-slate-500 mb-2 max-h-20 overflow-y-auto">
                  {itemsToBill.map(
                    (
                      item: {
                        productName: string;
                        qty: number;
                        price: number;
                        total: number;
                      },
                      idx: number
                    ) => (
                      <div key={idx} className="flex justify-between">
                        <span>
                          {item.qty}x {item.productName}
                        </span>
                        <span>{formatCurrency(item.total)}</span>
                      </div>
                    )
                  )}
                </div>
                {/* Subtotal + Tax + Total */}
                <div className="text-xs border-t border-slate-200 pt-2 space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax ({taxRate}%)</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-slate-800 pt-1 border-t border-dashed">
                    <span>Bill Total</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                </div>

                {/* DP Logic */}
                {Number(order?.computed?.actualDpAmount || 0) > 0 && (
                  <div className="flex justify-between text-green-700 text-xs">
                    <span>Less: DP Allocation (Est.)</span>
                    <span>
                      -
                      {formatCurrency(
                        (totalAmount /
                          Number(order?.totalAmount || 1)) *
                          Number(order?.computed?.actualDpAmount || 0)
                      )}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center bg-blue-50 p-2 rounded text-blue-800 font-bold">
                  <span>Net Payable Amount</span>
                  <span className="text-lg">
                    {formatCurrency(
                      totalAmount -
                        (Number(
                          order?.computed?.actualDpAmount || 0
                        ) > 0
                          ? (totalAmount /
                              Number(order?.totalAmount || 1)) *
                            Number(
                              order?.computed?.actualDpAmount || 0
                            )
                          : 0)
                    )}
                  </span>
                </div>
              </div>

              {/* 3. Forecast */}
              <div className="flex justify-between text-slate-500 text-xs pt-1">
                <span>Remaining Unbilled (Forecast)</span>
                <span>
                  {formatCurrency(
                    Math.max(
                      0,
                      Number(order?.computed?.outstanding || 0) -
                        totalAmount
                    )
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Hidden Order ID & Fulfillment ID */}
          <input type="hidden" {...register('orderId')} />
          <input type="hidden" {...register('fulfillmentId')} />

          {(loadingDetails || (poId && !order)) && (
            <p className="text-sm text-gray-500">
              Loading details...
            </p>
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

            {/* Payment Terms inherited from PO - no input needed */}

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
              disabled={isCreating || (!poId && !loadingDetails)}
              isLoading={isCreating}
              loadingText="Creating..."
            >
              Create Bill
            </Button>
          </div>
        </form>
      </div>
    </FormModal>
  );
}
