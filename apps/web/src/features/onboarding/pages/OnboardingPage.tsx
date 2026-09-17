import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, CurrencyInput, Input, Label } from '@/components/ui';
import { Tooltip } from '@/components/ui/Tooltip';
import { BrandMark } from '@/components/brand/BrandMark';
import {
  ShoppingBagIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
  Cog6ToothIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  InformationCircleIcon,
  ArrowLeftIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
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

const ONBOARDING_STEPS_META = [
  { id: 'BUSINESS_SHAPE', label: 'Tipe Bisnis', number: 1 },
  { id: 'OPENING_BALANCE', label: 'Saldo Awal', number: 2 },
  { id: 'FIRST_TRANSACTION', label: 'Transaksi Pertama', number: 3 },
  { id: 'ALIVE_MOMENT', label: 'Selesai', number: 4 },
];

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

  const currentStepNumber = useMemo(() => {
    switch (step) {
      case CompanyOnboardingStep.BUSINESS_SHAPE:
      case CompanyOnboardingStep.WELCOME:
        return 1;
      case CompanyOnboardingStep.OPENING_BALANCE:
        return 2;
      case CompanyOnboardingStep.FIRST_TRANSACTION:
        return 3;
      case CompanyOnboardingStep.ALIVE_MOMENT:
      case CompanyOnboardingStep.DONE:
        return 4;
      default:
        return 1;
    }
  }, [step]);

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

  if (onboardingState.isLoading) {
    return (
      <div className="auth-grid-background flex min-h-screen items-center justify-center p-6">
        <div className="ambient-glow" />
        <div className="glass-panel flex flex-col items-center gap-4 rounded-3xl p-8 shadow-xl max-w-sm w-full text-center">
          <BrandMark size="lg" />
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Menyiapkan Onboarding
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Mohon tunggu beberapa saat...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (onboardingState.isError || !onboardingState.data) {
    return (
      <div className="auth-grid-background flex min-h-screen items-center justify-center p-6">
        <div className="ambient-glow" />
        <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-slate-900">
            Onboarding Gagal Dimuat
          </h2>
          <p className="text-sm text-slate-600">
            Terjadi kendala saat memuat status onboarding. Silakan coba ulangi
            atau ganti workspace.
          </p>
          <div className="space-y-2 pt-2">
            <Button
              className="w-full"
              onClick={() => onboardingState.refetch()}
            >
              Coba Lagi
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => navigate('/select-company')}
            >
              Ganti Workspace
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const shell = (
    title: string,
    subtitle: string,
    badgeText: string,
    content: React.ReactNode,
    maxWidth = 'max-w-xl'
  ) => (
    <div className="auth-grid-background flex min-h-screen flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
      <div className="ambient-glow" />

      {/* Header Bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-4xl items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandMark size="md" />
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900">
              Sync ERP
            </span>
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              <BuildingOffice2Icon className="h-3.5 w-3.5" />
              {currentCompany.name}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setCurrentCompany(null);
            navigate('/select-company');
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-2xs backdrop-blur-md transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          <span>Ganti Workspace</span>
        </button>
      </header>

      {/* Main Container */}
      <main className={`relative z-10 my-auto mx-auto w-full ${maxWidth} py-6`}>
        {/* Progress Stepper Bar */}
        <nav aria-label="Progress" className="mb-6">
          <ol className="flex items-center justify-between gap-2">
            {ONBOARDING_STEPS_META.map((s) => {
              const isDone = s.number < currentStepNumber;
              const isCurrent = s.number === currentStepNumber;

              return (
                <li
                  key={s.id}
                  className="flex-1"
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <div className="flex flex-col items-center gap-1.5 group">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                        isDone
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isCurrent
                          ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 shadow-md shadow-blue-500/25'
                          : 'border border-slate-300 bg-white text-slate-400'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircleIcon className="h-4 w-4" />
                      ) : (
                        s.number
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-semibold tracking-tight transition-colors hidden sm:inline ${
                        isCurrent
                          ? 'text-blue-600'
                          : isDone
                          ? 'text-slate-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Card Box */}
        <div className="glass-panel overflow-hidden rounded-3xl p-6 sm:p-10 transition-all duration-300">
          <div className="mb-8 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200/60 mb-3">
              <SparklesIcon className="h-3.5 w-3.5 text-blue-600" />
              <span>{badgeText}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {subtitle}
            </p>
          </div>

          {content}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mx-auto w-full max-w-4xl text-center text-xs text-slate-400">
        <p>© 2026 Sync ERP. Seluruh hak cipta dilindungi.</p>
      </footer>
    </div>
  );

  // STEP 1: BUSINESS SHAPE
  if (step === 'BUSINESS_SHAPE' || step === 'WELCOME') {
    return shell(
      'Pilih Model Operasional Bisnis',
      'Sync ERP akan secara otomatis mengonfigurasi bagan akun (Chart of Accounts), alur transaksi, dan modul yang sesuai dengan model usaha Anda.',
      'Langkah 1 dari 4 • Setup Operasional',
      <div className="space-y-4">
        {/* Card: Service & Rental */}
        <div
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
          className="group relative flex cursor-pointer flex-col rounded-2xl border-2 border-blue-200/80 bg-blue-50/40 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-600 hover:bg-blue-50/80 hover:shadow-lg hover:shadow-blue-500/10 active:scale-[0.99]"
        >
          <div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
            <SparklesIcon className="h-3 w-3" />
            Rekomendasi Utama
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/20">
              <WrenchScrewdriverIcon className="h-6 w-6" />
            </div>
            <div className="flex-1 pr-24">
              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                Rental & Layanan Jasa (Service)
              </h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Persewaan perlengkapan, booking jadwal, deposit uang jaminan,
                pengantaran/pengembalian, dan tagihan invoice berkala.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 shadow-2xs">
                  Sewa Berkala
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 shadow-2xs">
                  Deposit Jaminan
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 shadow-2xs">
                  Logistik & Ongkir
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card: Retail */}
        <div
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
          className="group flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white/90 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/20">
              <ShoppingBagIcon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">
                Retail & Toko Produk
              </h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Penjualan barang jadi, toko fisik, minimarket, distributor, atau
                e-commerce dengan manajemen perputaran stok aktif.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  Stok Barang Masuk/Keluar
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  Barcode POS
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  Harga Grosir/Ecer
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card: Manufacturing */}
        <div
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
          className="group flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white/90 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-600 text-white shadow-md shadow-amber-600/20">
              <Cog6ToothIcon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                Manufaktur & Pabrikasi
              </h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Pengolahan bahan mentah menjadi barang jadi menggunakan formula
                Bill of Materials (BOM) dan tracking biaya produksi.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  Bill of Materials (BOM)
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  Work in Progress (WIP)
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  HPP Produksi
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>,
      'max-w-2xl'
    );
  }

  // STEP 2: OPENING BALANCE
  if (step === 'OPENING_BALANCE') {
    const totalBalance = (cash || 0) + (bank || 0);

    return shell(
      'Saldo Awal Kas & Bank',
      'Tentukan saldo kas tunai dan saldo rekening bank saat pertama kali memulai pembukuan di Sync ERP. Boleh diisi 0 jika belum ada.',
      'Langkah 2 dari 4 • Posisi Keuangan',
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-2xs">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                💵
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900">
                  Kas Tunai (Cash)
                </span>
                <p className="text-[11px] text-slate-500">Uang fisik di kasir / brankas</p>
              </div>
            </div>
            <CurrencyInput
              value={cash}
              onChange={setCash}
              placeholder="0"
            />
            <div className="mt-2 flex gap-1">
              {[1000000, 5000000, 10000000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setCash((c) => c + amt)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  +{amt / 1000000}Jt
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-2xs">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                🏦
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900">
                  Rekening Bank
                </span>
                <p className="text-[11px] text-slate-500">Saldo akun bank operasional</p>
              </div>
            </div>
            <CurrencyInput
              value={bank}
              onChange={setBank}
              placeholder="0"
            />
            <div className="mt-2 flex gap-1">
              {[5000000, 20000000, 50000000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setBank((b) => b + amt)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                >
                  +{amt / 1000000}Jt
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Total Summary Display */}
        <div className="flex items-center justify-between rounded-xl bg-slate-100/90 p-4 text-slate-800">
          <div className="flex items-center gap-2">
            <BanknotesIcon className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-semibold">Total Modal Awal Terhitung:</span>
          </div>
          <span className="text-lg font-bold font-mono text-blue-600">
            Rp {totalBalance.toLocaleString('id-ID')}
          </span>
        </div>

        <button
          type="button"
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
          disabled={submitOpeningBalance.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:from-blue-500 hover:to-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitOpeningBalance.isPending ? (
            'Menyimpan Saldo Awal...'
          ) : (
            <>
              <span>Simpan & Lanjutkan</span>
              <ArrowRightIcon className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    );
  }

  // STEP 3: FIRST TRANSACTION
  if (step === 'FIRST_TRANSACTION') {
    const totalTx = (quantity || 0) * (unitPrice || 0);

    return shell(
      'Uji Coba Transaksi Pertama',
      'Kita simulasikan transaksi pembelian barang/aset pertama agar sistem jurnal akuntansi dan buku besar Anda langsung terverifikasi aktif.',
      'Langkah 3 dari 4 • Aktivasi Jurnal',
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nama Supplier / Pemasok"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Contoh: PT Sumber Rejeki"
            required
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <Label>Nama Barang / Aset</Label>
              <Tooltip content="Nama item yang akan dicatat ke inventaris aset dan laporan pembelian.">
                <InformationCircleIcon className="h-4 w-4 text-slate-400" />
              </Tooltip>
            </div>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Contoh: Unit AC Portable"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Kuantitas (Qty)"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            selectOnFocus
            required
          />
          <CurrencyInput
            label="Harga Satuan"
            value={unitPrice}
            onChange={setUnitPrice}
          />
        </div>

        {/* Live Total & Pay Now Toggle */}
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Estimasi Total Pembelian:</span>
            <span className="font-bold font-mono text-base text-slate-900">
              Rp {totalTx.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200/80 pt-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Bayar Langsung (Lunas)
              </div>
              <div className="text-xs text-slate-500">
                Otomatis potong Kas/Bank dan terbitkan bukti pembayaran
              </div>
            </div>
            <button
              type="button"
              className={`h-7 w-12 rounded-full p-0.5 transition-colors ${
                payNow ? 'bg-blue-600' : 'bg-slate-300'
              }`}
              onClick={() => setPayNow((v) => !v)}
            >
              <span
                className={`block h-6 w-6 bg-white rounded-full transition-transform shadow-xs ${
                  payNow ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <button
          type="button"
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
          disabled={runFirstTransaction.isPending || !supplierName || !productName}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:from-blue-500 hover:to-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {runFirstTransaction.isPending ? (
            'Mencatat Transaksi Pertama...'
          ) : (
            <>
              <span>Proses Transaksi & Selesaikan</span>
              <ArrowRightIcon className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    );
  }

  // STEP 4: ALIVE MOMENT (CELEBRATION)
  if (step === 'ALIVE_MOMENT') {
    return shell(
      'Sistem Telah Aktif & Siap Digunakan!',
      'Selamat! Workspace perusahaan Anda telah berhasil diinisialisasi dengan konfigurasi lengkap.',
      'Langkah 4 dari 4 • Selesai',
      <div className="text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-xl shadow-emerald-500/25">
          <CheckCircleIcon className="h-9 w-9" />
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-left space-y-2 text-xs text-emerald-900">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <span>✨ Apa yang telah disiapkan untuk Anda:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-emerald-800">
            <li>Bagan akun akuntansi (Chart of Accounts) standar industri</li>
            <li>Jurnal umum dan buku besar otomatis</li>
            <li>Modul rental, pesanan, dan manajemen mitra pelanggan</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={() =>
            complete.mutate(undefined, {
              onSuccess: (data: OnboardingCompanyUpdate) => {
                setCompanyFromMutation(data);
                navigate(getPostOnboardingPath(), { replace: true });
              },
            })
          }
          disabled={complete.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] disabled:opacity-50"
        >
          {complete.isPending ? (
            'Membuka Dashboard...'
          ) : (
            <>
              <span>Buka Dashboard Workspace Sekarang</span>
              <ArrowRightIcon className="h-5 w-5" />
            </>
          )}
        </button>
      </div>
    );
  }

  if (step === 'DONE') {
    navigate(getPostOnboardingPath(), { replace: true });
    return null;
  }

  return shell(
    'Inisialisasi Workspace',
    'Menyiapkan konfigurasi perusahaan Anda...',
    'Sinkronisasi Sistem',
    <div className="text-center py-4">
      <Button
        className="w-full"
        onClick={() => onboardingState.refetch()}
        isLoading={start.isPending}
      >
        Perbarui Status
      </Button>
    </div>
  );
}

