import React, { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import {
  Input,
  LoadingState,
  NoCompanySelected,
} from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';

export default function RentalSettingsPage() {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  const { data: policy, isLoading } =
    trpc.rental.policy.getCurrent.useQuery(undefined, {
      enabled: !!currentCompany?.id,
    });

  const updateMutation = trpc.rental.policy.update.useMutation({
    onSuccess: () => utils.rental.policy.getCurrent.invalidate(),
  });

  const [form, setForm] = useState({
    gracePeriodHours: 2,
    lateFeeDailyRate: 0,
    cleaningFee: 0,
    pickupGracePeriodHours: 2,
  });

  useEffect(() => {
    if (policy) {
      setForm({
        gracePeriodHours: policy.gracePeriodHours ?? 2,
        lateFeeDailyRate: Number(policy.lateFeeDailyRate) ?? 0,
        cleaningFee: Number(policy.cleaningFee) ?? 0,
        pickupGracePeriodHours: policy.pickupGracePeriodHours ?? 2,
      });
    }
  }, [policy]);

  if (isLoading) return <LoadingState />;
  if (!currentCompany)
    return (
      <NoCompanySelected message="Pilih perusahaan untuk mengelola pengaturan rental." />
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiAction(
      () =>
        updateMutation.mutateAsync({
          gracePeriodHours: Number(form.gracePeriodHours),
          lateFeeDailyRate: Number(form.lateFeeDailyRate),
          cleaningFee: Number(form.cleaningFee),
          pickupGracePeriodHours: Number(form.pickupGracePeriodHours),
        }),
      'Pengaturan berhasil disimpan'
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Pengaturan Rental"
        description="Konfigurasi kebijakan grace period, denda keterlambatan, dan biaya lainnya"
      />

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Grace Period Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b">
              <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
              <h3 className="font-medium text-gray-900">
                Kebijakan Waktu
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grace Period Pengembalian (jam)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={48}
                  value={String(form.gracePeriodHours)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      gracePeriodHours: Number(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  Toleransi keterlambatan sebelum denda dihitung
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grace Period Pengambilan (jam)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={48}
                  value={String(form.pickupGracePeriodHours)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      pickupGracePeriodHours: Number(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  Toleransi waktu pengambilan barang
                </p>
              </div>
            </div>
          </div>

          {/* Fee Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b">
              <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
              <h3 className="font-medium text-gray-900">
                Biaya Tambahan
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Denda Keterlambatan per Hari (Rp)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={String(form.lateFeeDailyRate)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lateFeeDailyRate: Number(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  Denda per hari setelah grace period
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Biaya Cleaning (Rp)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={String(form.cleaningFee)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cleaningFee: Number(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  Biaya pembersihan per transaksi
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="w-full px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {updateMutation.isPending
                ? 'Menyimpan...'
                : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}
