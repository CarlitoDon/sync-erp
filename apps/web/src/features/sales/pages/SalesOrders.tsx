import { useState } from 'react';
import {
  type PaymentTerms,
  PartnerTypeSchema,
  OrderTypeSchema,
} from '@sync-erp/shared';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useOrderForm } from '@/hooks/useOrderForm';
import FormModal from '@/components/ui/FormModal';
import { Button } from '@/components/ui/button';
import { NoCompanySelected } from '@/components/ui';
import SalesOrderList from '@/features/sales/components/SalesOrderList';
import Select from '@/components/ui/Select';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import PaymentModeSelector from '@/components/forms/PaymentModeSelector';
import OrderItemEditor from '@/components/forms/OrderItemEditor';

export default function SalesOrders() {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  const { data: customers = [] } = trpc.partner.list.useQuery(
    { type: PartnerTypeSchema.enum.CUSTOMER },
    { enabled: !!currentCompany?.id }
  );

  const { data: products = [] } = trpc.product.list.useQuery(
    undefined,
    {
      enabled: !!currentCompany?.id,
    }
  );

  const createMutation = trpc.salesOrder.create.useMutation({
    onSuccess: () => {
      utils.salesOrder.list.invalidate();
    },
  });

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
          partnerId,
          items,
          taxRate,
          type: OrderTypeSchema.enum.SALES,
          paymentTerms: paymentConfig.paymentTerms as PaymentTerms,
          dpPercent: paymentConfig.withDP
            ? paymentConfig.dpPercent
            : undefined,
          dpAmount: paymentConfig.withDP
            ? paymentConfig.dpAmount
            : undefined,
        }),
      'Sales Order created!'
    );
    handleClose();
  };

  const handleClose = () => {
    setIsModalOpen(false);
    resetForm();
  };

  if (!currentCompany) {
    return (
      <NoCompanySelected message="Please select a company to view sales orders." />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Sales Orders"
        description={`Manage customer orders and deliveries for ${currentCompany.name}`}
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Create SO
          </button>
        }
      />

      {/* Modal Form */}
      <FormModal
        isOpen={isModalOpen}
        onClose={handleClose}
        title="New Sales Order"
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer *
            </label>
            <Select
              required
              value={partnerId}
              onChange={setPartnerId}
              options={
                customers?.map((c) => ({
                  value: c.id,
                  label: c.name,
                })) || []
              }
              placeholder="Select a customer"
            />
          </div>

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
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid}
              isLoading={createMutation.isPending}
              loadingText="Processing..."
            >
              Create Sales Order
            </Button>
          </div>
        </form>
      </FormModal>

      <SalesOrderList />
    </PageContainer>
  );
}
