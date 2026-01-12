import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import {
  LoadingState,
  NoCompanySelected,
  Button,
} from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { formatCurrency, getSantiLivingAssetUrl } from '@/utils/format';
import {
  ArrowPathIcon,
  CubeTransparentIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

export default function RentalBundlesPage() {
  const { currentCompany } = useCompany();
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    data: bundles = [],
    isLoading,
    refetch,
  } = trpc.rentalBundle.list.useQuery(
    { companyId: currentCompany?.id || '' },
    {
      enabled: !!currentCompany?.id,
    }
  );

  const syncMutation =
    trpc.rentalBundle.syncFromSantiLiving.useMutation({
      onSuccess: (data) => {
        toast.success(`Berhasil sinkronisasi ${data.synced} bundle`);
        refetch();
      },
      onError: (error) => {
        toast.error(`Gagal sinkronisasi: ${error.message}`);
      },
      onSettled: () => {
        setIsSyncing(false);
      },
    });

  if (isLoading) return <LoadingState />;
  if (!currentCompany)
    return (
      <NoCompanySelected message="Pilih perusahaan untuk mengelola bundle rental." />
    );

  // Hardcoded bundle data from santi-living for sync (in a real app this might come from an API or file)
  // For now, we'll just trigger the sync with the known data structure
  const handleSync = async () => {
    if (
      !confirm('Sinkronisasi bundle dari master data Santi Living?')
    )
      return;

    setIsSyncing(true);

    // In a real scenario, we might fetch this from an endpoint or have it in a shared config
    // Here we define the standard packages as defined in products.json
    const bundlesToSync = [
      {
        externalId: 'package-single-standard',
        name: 'Single Standard (Paket)',
        shortName: 'Single Standard (Pkt)',
        description: 'Kasur + Sprei + Bantal + Selimut',
        dailyRate: 30000,
        dimensions: '90 x 200 cm',
        capacity: '1 orang',
        imagePath: '/images/paket-90.webp',
        includes: ['kasur busa', 'sprei', 'bantal', 'selimut'],
      },
      {
        externalId: 'package-single-super',
        name: 'Single Super (Paket)',
        shortName: 'Single Super (Pkt)',
        description: 'Kasur + Sprei + Bantal + Selimut',
        dailyRate: 35000,
        dimensions: '100 x 200 cm',
        capacity: '1 orang',
        imagePath: '/images/paket-100.webp',
        includes: ['kasur busa', 'sprei', 'bantal', 'selimut'],
      },
      {
        externalId: 'package-double',
        name: 'Double (Paket)',
        shortName: 'Double (Pkt)',
        description: 'Kasur + Sprei + Bantal + Selimut',
        dailyRate: 40000,
        dimensions: '120 x 200 cm',
        capacity: '1-2 orang',
        imagePath: '/images/paket-120.webp',
        includes: ['kasur busa', 'sprei', 'bantal', 'selimut'],
      },
      {
        externalId: 'package-queen',
        name: 'Queen (Paket)',
        shortName: 'Queen (Pkt)',
        description: 'Kasur + Sprei + 2 Bantal + Selimut',
        dailyRate: 50000,
        dimensions: '160 x 200 cm',
        capacity: '2 orang',
        imagePath: '/images/paket-160.webp',
        includes: ['kasur busa', 'sprei', '2 bantal', 'selimut'],
      },
      {
        externalId: 'package-king',
        name: 'King (Paket)',
        shortName: 'King (Pkt)',
        description: 'Kasur + Sprei + 2 Bantal + Selimut',
        dailyRate: 60000,
        dimensions: '180 x 200 cm',
        capacity: '2-3 orang',
        imagePath: '/images/paket-180.webp',
        includes: ['kasur busa', 'sprei', '2 bantal', 'selimut'],
      },
    ];

    syncMutation.mutate({
      companyId: currentCompany.id,
      bundles: bundlesToSync,
    });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Paket Bundle"
        description="Kelola paket bundle rental yang tersedia"
        actions={
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            variant="outline"
          >
            <ArrowPathIcon
              className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`}
            />
            Sync dari Santi Living
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bundles.map((bundle) => (
          <Card
            key={bundle.id}
            className="overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow"
          >
            {bundle.imagePath && (
              <div className="h-48 w-full bg-gray-100 relative">
                <img
                  src={getSantiLivingAssetUrl(bundle.imagePath)}
                  alt={bundle.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://placehold.co/600x400?text=No+Image';
                  }}
                />
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-medium text-gray-700">
                  {bundle.shortName}
                </div>
              </div>
            )}

            <div className="p-5 flex flex-col flex-1">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600">
                  {bundle.name}
                </h3>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl font-bold text-primary-600">
                  {formatCurrency(Number(bundle.dailyRate))}
                </span>
                <span className="text-sm text-gray-500">/ hari</span>
              </div>

              <div className="space-y-3 mb-6 flex-1">
                {bundle.dimensions && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium min-w-20">
                      Dimensi:
                    </span>
                    <span>{bundle.dimensions}</span>
                  </div>
                )}
                {bundle.capacity && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium min-w-20">
                      Kapasitas:
                    </span>
                    <span>{bundle.capacity}</span>
                  </div>
                )}
                {bundle.description && (
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                    {bundle.description}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Komponen Bundle
                </h4>
                {bundle.components.length > 0 ? (
                  <ul className="space-y-2">
                    {bundle.components.map((comp) => (
                      <li
                        key={comp.id}
                        className="text-sm flex justify-between items-center text-gray-700 bg-gray-50 px-3 py-1.5 rounded-full"
                      >
                        <span className="flex items-center gap-2">
                          <CubeTransparentIcon className="w-4 h-4 text-gray-400" />
                          <span>
                            {comp.componentLabel ||
                              comp.rentalItem.product.name}
                          </span>
                        </span>
                        <span className="font-medium text-gray-900 text-xs bg-white px-2 py-0.5 rounded border">
                          x{comp.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    Belum ada komponen
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}

        {bundles.length === 0 && (
          <div className="col-span-full py-12 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <CubeTransparentIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Belum ada bundle
            </h3>
            <p className="text-gray-500 mb-4">
              Silakan sinkronisasi bundle dari master data Santi
              Living.
            </p>
            <Button onClick={handleSync} disabled={isSyncing}>
              <ArrowPathIcon
                className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`}
              />
              Sync Bundle
            </Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
