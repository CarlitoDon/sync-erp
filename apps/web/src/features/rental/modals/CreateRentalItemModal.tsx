import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import FormModal from '@/components/ui/FormModal';
import { Input, CurrencyInput } from '@/components/ui';
import { apiAction } from '@/hooks/useApiAction';
import { DepositPolicyType } from '@sync-erp/shared';
import type { CreateRentalItemInput } from '@sync-erp/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateRentalItemModal({
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const { currentCompany } = useCompany();
  const utils = trpc.useUtils();

  // Fetch products
  const { data: products = [] } = trpc.product.list.useQuery(
    undefined,
    { enabled: isOpen && !!currentCompany?.id }
  );
  const { data: existingItems = [] } =
    trpc.rental.items.list.useQuery(undefined, {
      enabled: isOpen && !!currentCompany?.id,
    });

  const createMutation = trpc.rental.items.create.useMutation({
    onSuccess: () => {
      utils.rental.items.list.invalidate();
      onSuccess?.();
      handleClose();
    },
  });

  const [form, setForm] = useState({
    productId: '',
    dailyRate: 50000,
    weeklyRate: 300000,
    monthlyRate: 1000000,
    depositPolicyType: 'PERCENTAGE',
    depositPercentage: 50,
    depositPerUnit: 100000,
  });

  const resetForm = () => {
    setForm({
      productId: '',
      dailyRate: 50000,
      weeklyRate: 300000,
      monthlyRate: 1000000,
      depositPolicyType: 'PERCENTAGE',
      depositPercentage: 50,
      depositPerUnit: 100000,
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateRentalItemInput = {
      productId: form.productId,
      dailyRate: form.dailyRate,
      weeklyRate: form.weeklyRate,
      monthlyRate: form.monthlyRate,
      depositPolicyType: form.depositPolicyType as DepositPolicyType,
      depositPercentage: form.depositPercentage
        ? Number(form.depositPercentage)
        : undefined,
      depositPerUnit: form.depositPerUnit
        ? Number(form.depositPerUnit)
        : undefined,
    };

    await apiAction(
      () => createMutation.mutateAsync(payload),
      'Item rental berhasil dibuat'
    );
  };

  // Filter out products already linked to rental items
  const availableProducts = useMemo(
    () =>
      products.filter(
        (p) => !existingItems.some((ri) => ri.productId === p.id)
      ),
    [products, existingItems]
  );

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Buat Item Rental Baru"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Product Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pilih Produk *
          </label>
          <select
            value={form.productId}
            onChange={(e) =>
              setForm({ ...form, productId: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg"
            required
          >
            <option value="">Pilih produk...</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Produk yang sudah di-link ke rental tidak ditampilkan
          </p>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Tarif Sewa
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Harian
              </label>
              <CurrencyInput
                value={form.dailyRate}
                onChange={(val) =>
                  setForm({ ...form, dailyRate: val })
                }
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Mingguan
              </label>
              <CurrencyInput
                value={form.weeklyRate}
                onChange={(val) =>
                  setForm({ ...form, weeklyRate: val })
                }
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Bulanan
              </label>
              <CurrencyInput
                value={form.monthlyRate}
                onChange={(val) =>
                  setForm({ ...form, monthlyRate: val })
                }
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Kebijakan Deposit
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Tipe
              </label>
              <select
                value={form.depositPolicyType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    depositPolicyType: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="PERCENTAGE">Persentase</option>
                <option value="PER_UNIT">Per Unit</option>
                <option value="HYBRID">Hybrid (max)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                {form.depositPolicyType === 'PER_UNIT'
                  ? 'Deposit per Unit'
                  : 'Deposit %'}
              </label>
              {form.depositPolicyType === 'PER_UNIT' ? (
                <CurrencyInput
                  value={form.depositPerUnit}
                  onChange={(val) =>
                    setForm({ ...form, depositPerUnit: val })
                  }
                />
              ) : (
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={String(form.depositPercentage)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      depositPercentage: Number(e.target.value),
                    })
                  }
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
