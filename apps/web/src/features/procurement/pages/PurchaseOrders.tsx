import { useState } from 'react';
import {
  type PaymentTerms,
  PartnerTypeSchema,
  OrderTypeSchema,
} from '@sync-erp/shared';
import Select from '@/components/ui/Select';
import { NoCompanySelected } from '@/components/ui';
import { useCompany } from '@/contexts/CompanyContext';
import FormModal from '@/components/ui/FormModal';
import PurchaseOrderList from '@/features/procurement/components/PurchaseOrderList';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import { useOrderForm } from '@/hooks/useOrderForm';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import PaymentModeSelector from '@/components/forms/PaymentModeSelector';
import OrderItemEditor from '@/components/forms/OrderItemEditor';

export default function PurchaseOrders() {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  const createMutation = trpc.purchaseOrder.create.useMutation({
    onSuccess: () => utils.purchaseOrder.list.invalidate(),
  });

  const { data: suppliers = [] } = trpc.partner.list.useQuery(
    { type: PartnerTypeSchema.enum.SUPPLIER },
    { enabled: !!currentCompany?.id }
  );

  const { data: products = [] } = trpc.product.list.useQuery(
    undefined,
    {
      enabled: !!currentCompany?.id,
    }
  );

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Use shared order form hook
  const {
    partnerId,
    setPartnerId,
    items,
    taxRate,
    setTaxRate,
    paymentConfig,
    setPaymentConfig,
    currentItem,
    setCurrentItem,
    addItem,
    removeItem,
    resetForm,
    totals,
    isValid,
  } = useOrderForm();

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
          dpPercent: paymentConfig.withDP
            ? paymentConfig.dpPercent
            : undefined,
          dpAmount: paymentConfig.withDP
            ? paymentConfig.dpAmount
            : undefined,
        }),
      'Purchase order created!'
    );

    handleClose();
  };

  const handleClose = () => {
    setIsModalOpen(false);
    resetForm();
  };

  // Loading is handled by individual components or suspense, for page structure we render content
  if (!currentCompany) {
    return (
      <NoCompanySelected message="Please select a company to view purchase orders." />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Purchase Orders"
        description={`Manage your purchasing workflow for ${currentCompany.name}`}
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Create PO
          </button>
        }
      />

      {/* Modal Form */}
      <FormModal
        isOpen={isModalOpen}
        onClose={handleClose}
        title="New Purchase Order"
        maxWidth="4xl"
      >
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
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || createMutation.isPending}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {createMutation.isPending
                ? 'Processing...'
                : 'Create Purchase Order'}
            </button>
          </div>
        </form>
      </FormModal>

      <PurchaseOrderList />
    </PageContainer>
  );
}
