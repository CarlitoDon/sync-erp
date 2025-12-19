import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import { useBill } from '@/features/accounting/hooks/useBill';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { formatCurrency, formatDate } from '@/utils/format';
import { PaymentForm } from '@/features/accounting/components/PaymentForm';
import { getPaymentTermLabel } from '@sync-erp/shared';

export default function BillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const { getBill, postBill, voidBill } = useBill();

  const [bill, setBill] =
    useState<
      Awaited<ReturnType<ReturnType<typeof useBill>['getBill']>>
    >(null);
  const [loading, setLoading] = useState(true);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);

  const loadData = async () => {
    if (!id || !currentCompany) return;
    setLoading(true);
    try {
      const data = await getBill(id);
      setBill(data ?? null);
    } catch (error) {
      navigate('/bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, currentCompany?.id]);

  const handlePost = async () => {
    if (!bill) return;

    const confirmed = await confirm({
      title: 'Post Bill',
      message: 'This will post the bill to the ledger. Are you sure?',
      confirmText: 'Yes, Post',
    });

    if (confirmed) {
      const result = await postBill(bill.id);
      if (result) loadData();
    }
  };

  const handleVoid = async () => {
    if (!bill) return;

    const confirmed = await confirm({
      title: 'Void Bill',
      message: 'This will void the bill. Are you sure?',
      confirmText: 'Yes, Void',
      variant: 'danger',
    });

    if (confirmed) {
      const result = await voidBill(bill.id);
      if (result) loadData();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'POSTED':
        return 'bg-green-100 text-green-800';
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'PAID':
        return 'bg-blue-100 text-blue-800';
      case 'VOID':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || !currentCompany) {
    return <div>Loading...</div>;
  }

  if (!bill) return <div>Bill not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/bills')}
            className="text-blue-600 mb-2"
          >
            ← Back to Bills
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {bill.invoiceNumber}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(bill.status)}`}
            >
              {bill.status}
            </span>
          </div>
        </div>
        <div className="space-x-2">
          {bill.status === 'DRAFT' && (
            <Button onClick={handlePost}>Post Bill</Button>
          )}
          {bill.status === 'POSTED' && Number(bill.balance) > 0 && (
            <Button onClick={() => setIsPaymentFormOpen(true)}>
              Record Payment
            </Button>
          )}
          {bill.status !== 'VOID' && bill.status !== 'PAID' && (
            <Button
              variant="outline"
              onClick={handleVoid}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Void
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 border">
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500">Supplier</p>
            <p className="font-medium">{bill.partnerId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Date</p>
            <p className="font-medium">
              {formatDate(bill.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Due Date</p>
            <p className="font-medium">{formatDate(bill.dueDate)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Amount</p>
            <p className="font-medium text-lg">
              {formatCurrency(bill.amount.toNumber())}
            </p>
          </div>
        </div>

        {bill.paymentTermsString && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">Payment Terms</p>
            <p className="font-medium">
              {getPaymentTermLabel(bill.paymentTermsString)}
            </p>
          </div>
        )}
      </div>

      {/* Payment Form Modal */}
      {isPaymentFormOpen && (
        <PaymentForm
          isOpen={isPaymentFormOpen}
          onClose={() => setIsPaymentFormOpen(false)}
          invoiceId={bill.id}
          outstandingAmount={Number(bill.balance)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
