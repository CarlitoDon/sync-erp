import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button, CurrencyInput, Input, Label } from '@/components/ui';
import { Tooltip } from '@/components/ui/Tooltip';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useCompany } from '@/contexts/CompanyContext';
import { trpc } from '@/lib/trpc';
import {
  BusinessShape,
  CompanyOnboardingStatus,
  CompanyOnboardingStep,
} from '@sync-erp/shared';
import type { RouterOutputs } from '@/types/api';
import {
  getBillingPlanIntent,
  getPostCompanyRedirect,
} from '@/features/billing/planIntent';

type Step = CompanyOnboardingStep;
type OnboardingCompanyUpdate = RouterOutputs['onboarding']['start'];

const STEPS = new Set(Object.values(CompanyOnboardingStep));

function normalizeStep(raw: unknown): Step {
  if (typeof raw === 'string' && STEPS.has(raw as CompanyOnboardingStep)) {
    return raw as CompanyOnboardingStep;
  }
  return CompanyOnboardingStep.WELCOME;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentCompany, setCurrentCompany } = useCompany();

  const onboardingState = trpc.onboarding.getState.useQuery(undefined, {
    retry: false,
    enabled: Boolean(currentCompany),
  });

  const start = trpc.onboarding.start.useMutation();
  const selectShape = trpc.onboarding.selectBusinessShape.useMutation();
  const submitOpeningBalance = trpc.onboarding.submitOpeningBalance.useMutation();
  const runFirstTransaction = trpc.onboarding.runFirstTransactionRetail.useMutation();
  const complete = trpc.onboarding.complete.useMutation();

  const [cash, setCash] = useState(0);
  const [bank, setBank] = useState(0);
  const [supplierName, setSupplierName] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(100000);
  const [payNow, setPayNow] = useState(true);

  const step = useMemo(() => {
    if (!onboardingState.data) return CompanyOnboardingStep.WELCOME;
    return normalizeStep(onboardingState.data.onboardingStep);
  }, [onboardingState.data]);

  useEffect(() => {
    if (!currentCompany) return;
    if (!onboardingState.data) return;
    if (onboardingState.data.onboardingStatus === CompanyOnboardingStatus.ACTIVE) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentCompany, onboardingState.data, navigate]);

  useEffect(() => {
    if (!currentCompany) return;
    if (onboardingState.isLoading) return;
    if (onboardingState.isError) return;
    if (!onboardingState.data) return;

    if (
      onboardingState.data.onboardingStatus ===
      CompanyOnboardingStatus.NOT_INITIALIZED
    ) {
      start.mutate(undefined, {
        onSuccess: () => onboardingState.refetch(),
      });
    }
  }, [
    currentCompany,
    onboardingState.isLoading,
    onboardingState.isError,
    onboardingState.data,
    onboardingState,
    start,
  ]);

  if (!currentCompany) {
    return null;
  }

  if (onboardingState.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Menyiapkan onboarding…</CardTitle>
            <CardDescription>Mohon tunggu sebentar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button isLoading className="w-full">
              Loading
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (onboardingState.isError || !onboardingState.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Onboarding gagal dimuat</CardTitle>
            <CardDescription>
              Coba ulangi. Kalau masih gagal, cek koneksi atau login ulang.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              onClick={() => onboardingState.refetch()}
            >
              Coba lagi
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => navigate('/select-company')}
            >
              Ganti company
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const setCompanyFromMutation = (data: OnboardingCompanyUpdate) => {
    if (!currentCompany) return;
    setCurrentCompany({
      ...currentCompany,
      businessShape: data.businessShape,
      onboardingStatus: data.onboardingStatus,
      onboardingStep: data.onboardingStep,
    });
  };

  const getPostOnboardingPath = () => {
    if (
      searchParams.get('next') === 'billing' ||
      getBillingPlanIntent()
    ) {
      return getPostCompanyRedirect();
    }

    return '/dashboard';
  };

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center">
          <div className="text-sm text-gray-500">Company</div>
          <div className="text-lg font-semibold text-gray-900">
            {currentCompany.name}
          </div>
        </div>
        {content}
      </div>
    </div>
  );

  if (step === 'BUSINESS_SHAPE') {
    return shell(
      <Card>
        <CardHeader>
          <CardTitle>Pilih tipe bisnis</CardTitle>
          <CardDescription>
            Ini menentukan konfigurasi awal dan chart of accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3">
          <Button
            onClick={() =>
              selectShape.mutate(
                { shape: BusinessShape.RETAIL },
                {
                  onSuccess: (data: OnboardingCompanyUpdate) => {
                    setCompanyFromMutation(data);
                    onboardingState.refetch();
                  },
                }
              )
            }
            isLoading={selectShape.isPending}
          >
            Retail
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              selectShape.mutate(
                { shape: BusinessShape.SERVICE },
                {
                  onSuccess: (data: OnboardingCompanyUpdate) => {
                    setCompanyFromMutation(data);
                    onboardingState.refetch();
                  },
                }
              )
            }
            isLoading={selectShape.isPending}
          >
            Service
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              selectShape.mutate(
                { shape: BusinessShape.MANUFACTURING },
                {
                  onSuccess: (data: OnboardingCompanyUpdate) => {
                    setCompanyFromMutation(data);
                    onboardingState.refetch();
                  },
                }
              )
            }
            isLoading={selectShape.isPending}
          >
            Manufacturing
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'OPENING_BALANCE') {
    return shell(
      <Card>
        <CardHeader>
          <CardTitle>Saldo awal</CardTitle>
          <CardDescription>
            Masukkan saldo awal kas dan bank. Boleh 0.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CurrencyInput
            label="Kas"
            value={cash}
            onChange={setCash}
            placeholder="0"
          />
          <CurrencyInput
            label="Bank"
            value={bank}
            onChange={setBank}
            placeholder="0"
          />
          <Button
            className="w-full"
            onClick={() =>
              submitOpeningBalance.mutate(
                { cash, bank },
                {
                  onSuccess: (data: OnboardingCompanyUpdate) => {
                    setCompanyFromMutation(data);
                    onboardingState.refetch();
                  },
                }
              )
            }
            isLoading={submitOpeningBalance.isPending}
          >
            Lanjut
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'FIRST_TRANSACTION') {
    return shell(
      <Card>
        <CardHeader>
          <CardTitle>Transaksi pertama</CardTitle>
          <CardDescription>
            Kita buat pembelian sederhana supaya stok dan jurnal aktif.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Nama supplier"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Contoh: Supplier A"
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <Label>Nama produk</Label>
              <Tooltip content="Ini adalah nama produk yang akan muncul di invoice dan laporan stok.">
                <InformationCircleIcon className="h-4 w-4 text-slate-400" />
              </Tooltip>
            </div>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Contoh: Produk 1"
            />
          </div>
          <Input
            label="Quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            selectOnFocus
          />
          <CurrencyInput
            label="Harga per unit"
            value={unitPrice}
            onChange={setUnitPrice}
          />
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
            <div>
              <div className="text-sm font-medium text-gray-900">Bayar sekarang</div>
              <div className="text-xs text-gray-500">Buat bill + payment</div>
            </div>
            <button
              type="button"
              className={`h-6 w-11 rounded-full transition-colors ${
                payNow ? 'bg-primary-600' : 'bg-gray-300'
              }`}
              onClick={() => setPayNow((v) => !v)}
            >
              <span
                className={`block h-5 w-5 bg-white rounded-full translate-y-0.5 transition-transform ${
                  payNow ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <Button
            className="w-full"
            onClick={() =>
              runFirstTransaction.mutate(
                {
                  supplierName,
                  productName,
                  quantity,
                  unitPrice,
                  payNow,
                },
                {
                  onSuccess: () => onboardingState.refetch(),
                }
              )
            }
            isLoading={runFirstTransaction.isPending}
            disabled={!supplierName || !productName}
          >
            Jalankan transaksi pertama
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'ALIVE_MOMENT') {
    return shell(
      <Card>
        <CardHeader>
          <CardTitle>Sistem sudah hidup</CardTitle>
          <CardDescription>
            Company kamu sudah siap dipakai. Lanjut ke dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full"
            onClick={() =>
              complete.mutate(undefined, {
                onSuccess: (data: OnboardingCompanyUpdate) => {
                  setCompanyFromMutation(data);
                  navigate(getPostOnboardingPath(), { replace: true });
                },
              })
            }
            isLoading={complete.isPending}
          >
            Masuk dashboard
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => {
              setCurrentCompany(null);
              navigate('/select-company', { replace: true });
            }}
          >
            Ganti company
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'DONE') {
    navigate(getPostOnboardingPath(), { replace: true });
    return null;
  }

  return shell(
    <Card>
      <CardHeader>
        <CardTitle>Onboarding</CardTitle>
        <CardDescription>Menyiapkan company kamu…</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full"
          onClick={() => onboardingState.refetch()}
          isLoading={start.isPending}
        >
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
}
