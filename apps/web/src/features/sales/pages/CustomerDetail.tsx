import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, PencilSquareIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { trpc } from '@/lib/trpc';
import ActionButton from '@/components/ui/ActionButton';
import FormModal from '@/components/ui/FormModal';
import { Input, LoadingState } from '@/components/ui';
import SalesOrderList from '@/features/sales/components/SalesOrderList';
import { InvoiceList } from '@/features/accounting/components/InvoiceList';
import { formatDate, formatCurrency } from '@/utils/format';
import { PageContainer } from '@/components/layout/PageLayout';
import { apiAction } from '@/hooks/useApiAction';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/Card';
import { PartnerType, RentalOrderStatus } from '@sync-erp/shared';

/* eslint-disable @sync-erp/no-hardcoded-enum */
type Tab = 'rental_orders' | 'orders' | 'invoices';
/* eslint-enable @sync-erp/no-hardcoded-enum */

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<Tab>('rental_orders');

  const {
    data: customer,
    isLoading: loading,
    error,
  } = trpc.partner.getById.useQuery({ id: id! }, { enabled: !!id });

  const { data: rentalOrdersData, isLoading: loadingRental } =
    trpc.rental.orders.list.useQuery(
      { partnerId: id! },
      { enabled: !!id }
    );
  const rentalOrders = rentalOrdersData?.items || [];

  const { data: allPartners = [] } = trpc.partner.list.useQuery(
    { type: PartnerType.CUSTOMER },
    { enabled: !!customer }
  );
  const mergeCandidates = allPartners.filter((p) => p.id !== id);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    kecamatan: '',
    kota: '',
  });

  const updateMutation = trpc.partner.update.useMutation({
    onSuccess: () => {
      utils.partner.getById.invalidate({ id: id! });
      utils.partner.list.invalidate();
    },
  });

  const handleOpenEdit = useCallback(() => {
    if (!customer) return;
    setEditForm({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      kecamatan: customer.kecamatan || '',
      kota: customer.kota || '',
    });
    setIsEditOpen(true);
  }, [customer]);

  const handleEditSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id) return;
      await apiAction(
        () =>
          updateMutation.mutateAsync({
            id,
            data: {
              name: editForm.name,
              email: editForm.email || undefined,
              phone: editForm.phone || undefined,
              address: editForm.address || undefined,
              kecamatan: editForm.kecamatan || undefined,
              kota: editForm.kota || undefined,
            },
          }),
        'Customer updated successfully'
      );
      setIsEditOpen(false);
    },
    [id, editForm, updateMutation]
  );

  // Merge Modal State
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState('');

  const mergeMutation = trpc.partner.merge.useMutation({
    onSuccess: () => {
      utils.partner.getById.invalidate({ id: id! });
      utils.partner.list.invalidate();
      utils.rental.orders.list.invalidate();
    },
  });

  const handleMergeSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id || !selectedSourceId) return;
      await apiAction(
        () =>
          mergeMutation.mutateAsync({
            targetPartnerId: id,
            sourcePartnerIds: [selectedSourceId],
          }),
        'Customer merged successfully'
      );
      setIsMergeOpen(false);
      setSelectedSourceId('');
    },
    [id, selectedSourceId, mergeMutation]
  );

  if (loading && !customer) {
    return <LoadingState />;
  }

  if (error || (!loading && !customer)) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Customer not found</h2>
        <ActionButton
          onClick={() => window.history.back()}
          variant="secondary"
          className="mt-4"
        >
          Go Back
        </ActionButton>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <PageContainer>
      <div className="flex items-center gap-4">
        <button
          onClick={() => window.history.back()}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeftIcon className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium text-xs">
              Customer
            </span>
            <span>•</span>
            <span>Joined {formatDate(customer.createdAt)}</span>
            {customer.kecamatan && (
              <>
                <span>•</span>
                <span className="font-medium text-slate-700">Kec. {customer.kecamatan}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Info Card */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </label>
                  <div className="mt-1 text-sm text-gray-900">
                    {customer.email ? (
                      <a
                        href={`mailto:${customer.email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {customer.email}
                      </a>
                    ) : (
                      '-'
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </label>
                  <div className="mt-1 text-sm text-gray-900 font-mono">
                    {customer.phone || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Address
                  </label>
                  <div className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                    {customer.address || '-'}
                  </div>
                </div>
                {(customer.kecamatan || customer.kota) && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-gray-500">Kecamatan:</span>
                      <p className="font-medium text-gray-900">{customer.kecamatan || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Kota/Kab:</span>
                      <p className="font-medium text-gray-900">{customer.kota || '-'}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="w-full inline-flex justify-center items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                  Edit Customer
                </button>
                {mergeCandidates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsMergeOpen(true)}
                    className="w-full inline-flex justify-center items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 bg-white rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    <ArrowsRightLeftIcon className="w-4 h-4 text-slate-500" />
                    Merge Duplicate Customer
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Areas */}
        <div className="md:col-span-2">
          <Card className="min-h-125 overflow-hidden">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('rental_orders')}
                  className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'rental_orders'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Rental Orders ({rentalOrders.length})
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'orders'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Sales Orders
                </button>
                <button
                  onClick={() => setActiveTab('invoices')}
                  className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'invoices'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Invoices
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'rental_orders' && (
                <div>
                  {loadingRental ? (
                    <LoadingState />
                  ) : rentalOrders.length === 0 ? (
                    <div className="text-center py-8 text-sm text-slate-500">
                      Belum ada pesanan rental untuk customer ini.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-slate-600">
                              No. Order
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-slate-600">
                              Periode Sewa
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-slate-600">
                              Status
                            </th>
                            <th className="px-4 py-3 text-right font-medium text-slate-600">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {rentalOrders.map((ro) => (
                            <tr key={ro.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-semibold text-primary-600">
                                <Link to={`/rental/orders/${ro.id}`} className="hover:underline">
                                  {ro.orderNumber}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-slate-600 text-xs">
                                {formatDate(ro.rentalStartDate)} – {formatDate(ro.rentalEndDate)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                    ro.status === RentalOrderStatus.COMPLETED
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : ro.status === RentalOrderStatus.ACTIVE
                                      ? 'bg-sky-100 text-sky-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {ro.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-800">
                                {formatCurrency(Number(ro.totalAmount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'orders' && (
                <SalesOrderList filter={{ partnerId: id }} />
              )}
              {activeTab === 'invoices' && (
                <InvoiceList filter={{ partnerId: id }} />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Edit Customer Modal */}
      <FormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Customer"
      >
        <form onSubmit={handleEditSubmit} className="grid grid-cols-2 gap-4">
          <Input
            label="Name"
            type="text"
            required
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <Input
            label="Phone"
            type="text"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <Input
            label="Kecamatan"
            type="text"
            value={editForm.kecamatan}
            onChange={(e) =>
              setEditForm({ ...editForm, kecamatan: e.target.value })
            }
          />
          <Input
            label="Kota/Kabupaten"
            type="text"
            value={editForm.kota}
            onChange={(e) => setEditForm({ ...editForm, kota: e.target.value })}
          />
          <Input
            label="Address"
            type="text"
            value={editForm.address}
            onChange={(e) =>
              setEditForm({ ...editForm, address: e.target.value })
            }
          />
          <div className="col-span-2 flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Save Changes
            </button>
          </div>
        </form>
      </FormModal>

      {/* Merge Duplicate Customer Modal */}
      <FormModal
        isOpen={isMergeOpen}
        onClose={() => {
          setIsMergeOpen(false);
          setSelectedSourceId('');
        }}
        title="Merge Duplicate Customer"
      >
        <form onSubmit={handleMergeSubmit} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
            <p className="font-semibold">Perhatian Penggabungan Customer:</p>
            <p>
              Semua riwayat pesanan sewa (rental orders), sales order, dan tagihan dari customer duplikat yang dipilih di bawah akan otomatis dipindahkan ke <strong>{customer.name}</strong>.
            </p>
            <p className="text-rose-700 font-semibold">
              Data customer duplikat akan dihapus secara permanen setelah digabung.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Pilih Customer Duplikat yang Ingin Digabung ke {customer.name}:
            </label>
            <select
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">-- Pilih Customer Duplikat --</option>
              {mergeCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''} {c.address ? `- ${c.address}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setIsMergeOpen(false);
                setSelectedSourceId('');
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!selectedSourceId}
              className="px-6 py-2 bg-rose-600 disabled:opacity-50 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium shadow-sm"
            >
              Gabungkan ke {customer.name}
            </button>
          </div>
        </form>
      </FormModal>
    </PageContainer>
  );
}
