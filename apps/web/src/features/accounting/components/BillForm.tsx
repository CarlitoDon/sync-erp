import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useCompany } from '@/contexts/CompanyContext';
import { useBill, CreateBillInput } from '@/features/accounting/hooks/useBill';
import { useGoodsReceipt } from '@/features/procurement/hooks/useGoodsReceipt'; // To fetch GRN details
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/Select';
import { PAYMENT_TERMS, calculateDueDate } from '@sync-erp/shared';

export default function BillForm() {
  const [searchParams] = useSearchParams();
  const grnId = searchParams.get('grnId');
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { createFromPO, loading: submitting } = useBill();
  const { getReceipt } = useGoodsReceipt();

  const { register, handleSubmit, setValue, watch, control } = useForm<CreateBillInput>({
    defaultValues: {
      invoiceNumber: '',
      taxRate: 0,
      paymentTermsString: 'NET30',
    }
  });

  const businessDate = watch('businessDate');
  const paymentTermsString = watch('paymentTermsString');

  // Auto-calculate dueDate when businessDate or payment terms change
  useEffect(() => {
    if (businessDate && paymentTermsString) {
      const calculated = calculateDueDate(new Date(businessDate), paymentTermsString);
      setValue('dueDate', calculated);
    }
  }, [businessDate, paymentTermsString, setValue]);

  // Watch for dynamic calculation if needed, though for now we rely on backend logic mostly
  // But strictly, UI should show items. Backend createFromPO takes orderId, but UI might want to show items.
  // The current backend createFromPO implementation only takes `orderId` and assumes all items from PO are billed.
  // Wait, if we are creating from GRN, we should probably pass GRN ID?
  // Let's check BillService.createFromPurchaseOrder again.
  // It takes `orderId`. It checks GRN count.
  // It creates invoice based on PO items.
  // It DOES NOT support partial billing or billing specific GRN items yet based on the code I saw (lines 106-121 of bill.service.ts).
  // It uses `order.items`.
  // So for now, we just need to pass the PO ID linked to the GRN.
  
  const [poId, setPoId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!currentCompany) return;

      if (grnId) {
        const grn = await getReceipt(grnId);
        if (grn) {
          setPoId(grn.purchaseOrderId);
          setValue('orderId', grn.purchaseOrderId);
          // We could pre-fill supplier if we had it, but GRN usually has PO which has supplier.
          // Getting PO details would be nice for UI but essential part is orderId.
        }
      }
    }
    loadData();
  }, [currentCompany, grnId]);

  const onSubmit = async (data: CreateBillInput) => {
    const result = await createFromPO(data);
    if (result) {
      navigate(`/bills/${result.id}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-sm border">
      <h1 className="text-2xl font-bold mb-6">Create Bill</h1>
      
      {grnId && !poId && <p>Loading GRN details...</p>}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Hidden Order ID */}
        <input type="hidden" {...register('orderId')} />

        <div className="grid gap-4">
             <div>
            <Label>Supplier Invoice Number *</Label>
            <Input 
                {...register('invoiceNumber', { required: true })} 
                placeholder="e.g. INV-2024-001"
            />
             </div>

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
              <Input type="date" {...register('businessDate', { valueAsDate: true, required: true })} />
            </div>
            <div>
              <Label>Due Date (Auto-calculated)</Label>
              <Input type="date" {...register('dueDate', { valueAsDate: true })} disabled className="bg-gray-50" />
            </div>
             </div>
             
             <div>
            <Label>Tax Rate (%)</Label>
             <Input 
                 type="number" 
                 step="0.01" 
                 {...register('taxRate', { valueAsNumber: true })} 
            />
             </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Bill'}
            </Button>
        </div>
      </form>
    </div>
  );
}
