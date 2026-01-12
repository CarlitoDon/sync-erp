import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { LoadingState, NoCompanySelected } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/format';
import {
  PlusIcon,
  CubeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { UnitStatus } from '@sync-erp/shared';
import type { RentalItemWithRelations } from '@sync-erp/shared';
import { UNIT_STATUS_COLORS, CONDITION_COLORS } from '../constants';
import CreateRentalItemModal from '../modals/CreateRentalItemModal';
import ConvertStockModal from '../modals/ConvertStockModal';
import { SearchInput } from '../components';

export default function RentalItemsPage() {
  const { currentCompany } = useCompany();

  const { data: items = [], isLoading } =
    trpc.rental.items.list.useQuery(undefined, {
      enabled: !!currentCompany?.id,
    });

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [selectedItem, setSelectedItem] =
    useState<RentalItemWithRelations | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.product?.name?.toLowerCase().includes(q) ||
        item.product?.sku?.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  if (isLoading) return <LoadingState />;
  if (!currentCompany)
    return (
      <NoCompanySelected message="Pilih perusahaan untuk mengelola rental." />
    );

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const openConvertModal = (item: RentalItemWithRelations) => {
    setSelectedItem(item);
    setIsConvertOpen(true);
  };

  const getAvailableCount = (
    units: RentalItemWithRelations['units']
  ) =>
    units?.filter((u) => u.status === UnitStatus.AVAILABLE).length ||
    0;

  const getTotalCount = (units: RentalItemWithRelations['units']) =>
    units?.length || 0;

  return (
    <PageContainer>
      <PageHeader
        title="Item Rental"
        description="Kelola jenis item rental dan unit fisik yang tersedia"
        actions={
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Tambah Item
          </button>
        }
      />

      {/* Modals */}
      <CreateRentalItemModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <ConvertStockModal
        isOpen={isConvertOpen}
        onClose={() => {
          setIsConvertOpen(false);
          setSelectedItem(null);
        }}
        itemId={selectedItem?.id || null}
        itemSku={selectedItem?.product?.sku}
        availableStock={selectedItem?.product?.stockQty ?? 0}
        onSuccess={() => {
          if (selectedItem) {
            setExpandedItems((prev) =>
              new Set(prev).add(selectedItem.id)
            );
          }
        }}
      />

      {/* Search */}
      <div className="mb-4 max-w-xs">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Cari nama produk atau SKU..."
        />
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <Card className="p-12 text-center">
          <CubeIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Belum ada item rental
          </h3>
          <p className="text-gray-500 mb-4">
            Mulai dengan membuat item rental pertama Anda
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg"
          >
            <PlusIcon className="w-5 h-5" />
            Tambah Item
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              {/* Item Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpand(item.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <CubeIcon className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {item.product?.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {item.product?.category?.name ||
                        'Uncategorized'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Pricing */}
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Harian</p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(Number(item.dailyRate))}
                    </p>
                  </div>

                  {/* Unit Count */}
                  <div className="text-center px-4 border-l">
                    <p className="text-2xl font-bold text-primary-600">
                      {getAvailableCount(item.units)}/
                      {getTotalCount(item.units)}
                    </p>
                    <p className="text-xs text-gray-500">Tersedia</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openConvertModal(item);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      title={`Stok Inventori: ${item.product?.stockQty ?? 0}`}
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Import
                    </button>

                    {expandedItems.has(item.id) ? (
                      <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Units */}
              {expandedItems.has(item.id) && (
                <div className="border-t bg-gray-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">
                      Daftar Unit ({getTotalCount(item.units)})
                    </h4>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                        Tersedia: {getAvailableCount(item.units)}
                      </span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        Disewa:{' '}
                        {item.units?.filter(
                          (u) => u.status === UnitStatus.RENTED
                        ).length || 0}
                      </span>
                    </div>
                  </div>

                  {item.units && item.units.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {item.units.map((unit) => (
                        <div
                          key={unit.id}
                          className="bg-white p-3 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono font-semibold text-gray-900">
                              {unit.unitCode}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${UNIT_STATUS_COLORS[unit.status] || 'bg-gray-100'}`}
                            >
                              {unit.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span
                              className={`px-2 py-0.5 rounded ${CONDITION_COLORS[unit.condition] || 'bg-gray-100'}`}
                            >
                              {unit.condition}
                            </span>
                            <span className="text-gray-500">
                              {unit.totalRentalCount || 0}x disewa
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Belum ada unit. Klik "+ Unit" untuk menambahkan.
                    </p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
