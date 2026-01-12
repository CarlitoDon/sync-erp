import { useEffect } from 'react';
import {
  type PaymentTerms,
  PartnerTypeSchema,
  OrderTypeSchema,
} from '@sync-erp/shared';
import Select from '@/components/ui/Select';
import { Button } from '@/components/ui/button';
import FormModal from '@/components/ui/FormModal';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import { useOrderForm, type OrderItemForm } from '@/hooks/useOrderForm';
import PaymentModeSelector from '@/components/forms/PaymentModeSelector';
import OrderItemEditor from '@/components/forms/OrderItemEditor';
import { useCompany } from '@/contexts/CompanyContext';

export interface PrefillItem {
  productId: string;
  quantity: number;
  price?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialItems?: PrefillItem[];
  title?: string;
}

export default function CreatePurchaseOrderModal({
  isOpen,
  onClose,
  onSuccess,
  initialItems = [],
  title = 'New Purchase Order',
}: Props) {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  const createMutation = trpc.purchaseOrder.create.useMutation({
    onSuccess: () => {
      utils.purchaseOrder.list.invalidate();
      onSuccess?.();
    },
  });

  const { data: suppliers = [] } = trpc.partner.list.useQuery(
    { type: PartnerTypeSchema.enum.SUPPLIER },
    { enabled: isOpen && !!currentCompany?.id }
  );

  const { data: products = [] } = trpc.product.list.useQuery(undefined, {
    enabled: isOpen && !!currentCompany?.id,
  });

  // Use shared order form hook
  const {
    partnerId,
    setPartnerId,
    items,
    setItems,
    taxRate,
    setTaxRate,
    paymentConfig,
    setPaymentConfig,
    currentItem,
    setCurrentItem,
    addItem,
    updateItem,
    removeItem,
    resetForm,
    totals,
    isValid,
  } = useOrderForm();

  // Prefill items when modal opens
  useEffect(() => {
    if (isOpen && initialItems.length > 0 && products.length > 0) {
      const prefilled: OrderItemForm[] = initialItems
        .map((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (!product) return null;
          return {
            productId: item.productId,
            quantity: item.quantity,
            price: item.price ?? Number(product.price),
          };
        })
        .filter((item): item is OrderItemForm => item !== null);

      if (prefilled.length > 0) {
        setItems(prefilled);
      }
    }
  }, [isOpen, initialItems, products, setItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    await apiAction(
      () =>
        createMutation.mutateAsync({
          type: OrderTypeSchema.enum.PURCHASE,
          partnerId,
          items,
          taxRate,
          paymentTerms: paymentConfig.paymentTerms as PaymentTerms,
          dpPercent: paymentConfig.withDP ? paymentConfig.dpPercent : undefined,
          dpAmount: paymentConfig.withDP ? paymentConfig.dpAmount : undefined,
        }),
      'Purchase order created!'
    );

    handleClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <FormModal isOpen={isOpen} onClose={handleClose} title={title} maxWidth="4xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supplier *
          </label>
          <Select
            required
            value={partnerId}
            onChange={setPartnerId}
            options={suppliers.map((s) => ({
              value: s.id,
              label: s.name,
            }))}
            placeholder="Select a supplier"
          />
        </div>

        {/* Tax Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tax Rate
          </label>
          <Select
            value={taxRate}
            onChange={(val) => setTaxRate(Number(val))}
            options={[
              { value: 0, label: 'No Tax (0%)' },
              { value: 11, label: 'PPN 11%' },
              { value: 12, label: 'PPN 12%' },
            ]}
            placeholder="Select Tax Rate"
          />
        </div>

        {/* Order Items Editor */}
        <OrderItemEditor
          products={products}
          currentItem={currentItem}
          onCurrentItemChange={setCurrentItem}
          onAddItem={addItem}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          items={items}
          totals={totals}
        />

        {/* Payment Mode Selector - After items */}
        <PaymentModeSelector
          totalAmount={totals.grandTotal}
          value={paymentConfig}
          onChange={setPaymentConfig}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!isValid}
            isLoading={createMutation.isPending}
            loadingText="Processing..."
            className="px-6"
          >
            Create Purchase Order
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
