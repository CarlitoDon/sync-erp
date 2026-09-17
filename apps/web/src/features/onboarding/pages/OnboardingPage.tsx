import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, CurrencyInput, Input, Label } from '@/components/ui';
import { Tooltip } from '@/components/ui/Tooltip';
import { BrandMark } from '@/components/brand/BrandMark';
import {
  ShoppingBagIcon,
  SparklesIcon,
  Cog6ToothIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  InformationCircleIcon,
  ArrowLeftIcon,
  BuildingOffice2Icon,
  BriefcaseIcon,
  TruckIcon,
  CheckIcon,
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

function parseBusinessShape(raw: unknown): BusinessShape {
  if (raw === BusinessShape.RENTAL) return BusinessShape.RENTAL;
  if (raw === BusinessShape.SERVICE) return BusinessShape.SERVICE;
  if (raw === BusinessShape.RETAIL) return BusinessShape.RETAIL;
  if (raw === BusinessShape.MANUFACTURING) return BusinessShape.MANUFACTURING;
  return BusinessShape.RENTAL;
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
  const [selectedShape, setSelectedShape] = useState<BusinessShape>(() =>
    parseBusinessShape(currentCompany?.businessShape)
  );

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
    maxWidth = 'max-w-5xl'
  ) => (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Ambient soft glow at top */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-gradient-to-b from-blue-100/40 via-sky-50/20 to-transparent blur-3xl" />
      </div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-20 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <span className="text-sm font-bold tracking-tight text-slate-900">
              Sync ERP
            </span>
            <span className="text-slate-300">/</span>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              <BuildingOffice2Icon className="h-3.5 w-3.5 text-slate-500" />
              <span>{currentCompany.name}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCurrentCompany(null);
              navigate('/select-company');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-95"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5 text-slate-400" />
            <span>Ganti Workspace</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className={`relative z-10 mx-auto w-full ${maxWidth} px-4 py-8 sm:px-6`}>
        {/* Modern Segmented Progress Stepper */}
        <nav aria-label="Progress" className="mb-8">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            {ONBOARDING_STEPS_META.map((s) => {
              const isDone = s.number < currentStepNumber;
              const isCurrent = s.number === currentStepNumber;

              return (
                <div
                  key={s.id}
                  className={`flex flex-col gap-2 rounded-2xl border p-3.5 transition-all duration-200 ${
                    isCurrent
                      ? 'border-blue-500/50 bg-white shadow-sm ring-1 ring-blue-500/20'
                      : isDone
                      ? 'border-slate-200/80 bg-white/70 shadow-2xs'
                      : 'border-slate-200/40 bg-white/40 opacity-60'
                  }`}
                >
                  <div
                    className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                      isDone
                        ? 'bg-emerald-500'
                        : isCurrent
                        ? 'bg-blue-600'
                        : 'bg-slate-200'
                    }`}
                  />
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-bold tabular-nums tracking-wide uppercase ${
                        isCurrent
                          ? 'text-blue-600'
                          : isDone
                          ? 'text-emerald-700'
                          : 'text-slate-400'
                      }`}
                    >
                      Langkah 0{s.number}
                    </span>
                    {isDone && (
                      <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold tracking-tight truncate ${
                      isCurrent
                        ? 'text-slate-900'
                        : isDone
                        ? 'text-slate-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Card Box */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-xl shadow-slate-900/5 transition-all duration-300">
          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200/60 mb-3">
              <SparklesIcon className="h-3.5 w-3.5 text-blue-600" />
              <span>{badgeText}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-2 text-sm text-slate-500 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          </div>

          {content}
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-center text-xs text-slate-400">
        <p>© 2026 Sync ERP. Seluruh hak cipta dilindungi.</p>
      </footer>
    </div>
  );

  // STEP 1: BUSINESS SHAPE
  if (step === 'BUSINESS_SHAPE' || step === 'WELCOME') {
    const SHAPES = [
      {
        id: BusinessShape.RENTAL,
        name: 'Rental & Persewaan Aset',
        description:
          'Penyewaan unit fisik, peralatan, kendaraan, atau properti dengan tracking deposit dan siklus pengembalian.',
        icon: TruckIcon,
        features: [
          'Inventaris aset disewakan & serial number',
          'Uang jaminan sewa (deposit) & denda return',
          'Kalender booking & jadwal pengembalian',
        ],
      },
      {
        id: BusinessShape.SERVICE,
        name: 'Jasa & Layanan Profesional',
        description:
          'Konsultan, agensi kreatif, software vendor, atau kontraktor dengan sistem penagihan termin/jam.',
        icon: BriefcaseIcon,
        features: [
          'Billing termin, milestone, atau jam kerja',
          'Pencatatan beban tenaga kerja langsung',
          'Operasional murni tanpa stok fisik barang',
        ],
      },
      {
        id: BusinessShape.RETAIL,
        name: 'Retail & Toko Produk',
        description:
          'Penjualan barang jadi, toko fisik, minimarket, distributor, atau e-commerce dengan perputaran stok aktif.',
        icon: ShoppingBagIcon,
        features: [
          'Stok barang masuk/keluar & barcode POS',
          'Tingkatan harga (grosir, eceran, promo)',
          'Perhitungan HPP otomatis (Average / FIFO)',
        ],
      },
      {
        id: BusinessShape.MANUFACTURING,
        name: 'Manufaktur & Pabrikasi',
        description:
          'Pengolahan bahan mentah menjadi produk jadi melalui tahapan work order dan kalkulasi HPP pabrik.',
        icon: Cog6ToothIcon,
        features: [
          'Bill of Materials (BOM) & resep produksi',
          'Surat Perintah Kerja (SPK / Work Order)',
          'Alokasi biaya bahan baku, tenaga kerja, & overhead',
        ],
      },
    ];

    const currentSelected =
      SHAPES.find((s) => s.id === selectedShape) || SHAPES[0];

    return shell(
      'Pilih Model Operasional Bisnis',
      'Sync ERP akan secara otomatis mengonfigurasi bagan akun (Chart of Accounts), alur transaksi, dan modul yang sesuai dengan model usaha Anda.',
      'Langkah 1 dari 4 • Setup Operasional',
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SHAPES.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedShape === item.id;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedShape(item.id)}
                onDoubleClick={() => {
                  setSelectedShape(item.id);
                  selectShape.mutate(
                    { shape: item.id },
                    {
                      onSuccess: (data: OnboardingCompanyUpdate) => {
                        setCompanyFromMutation(data);
                        onboardingState.refetch();
                      },
                    }
                  );
                }}
                className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-5 transition-all duration-200 select-none ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/25 ring-2 ring-blue-600/20 shadow-md shadow-blue-500/5'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-md hover:shadow-slate-900/5 hover:-translate-y-0.5 active:scale-[0.99]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                          : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Radio Check Indicator */}
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                        isSelected
                          ? 'bg-blue-600 text-white ring-2 ring-blue-600/20'
                          : 'border-2 border-slate-300 bg-white group-hover:border-slate-400'
                      }`}
                    >
                      {isSelected && (
                        <CheckIcon className="h-3 w-3 stroke-[3]" />
                      )}
                    </div>
                  </div>

                  <h3
                    className={`text-base font-bold transition-colors ${
                      isSelected
                        ? 'text-blue-700'
                        : 'text-slate-900 group-hover:text-blue-600'
                    }`}
                  >
                    {item.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed min-h-[34px]">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <ul className="space-y-1.5">
                    {item.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-center gap-2 text-xs text-slate-600"
                      >
                        <CheckIcon
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isSelected ? 'text-blue-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Confirmation Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-6">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <InformationCircleIcon className="h-4 w-4 text-slate-400 shrink-0" />
            <span>
              Pilihan: <strong className="text-slate-800">{currentSelected.name}</strong>. Anda dapat menyesuaikan modul di Pengaturan Perusahaan nanti.
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              selectShape.mutate(
                { shape: selectedShape },
                {
                  onSuccess: (data: OnboardingCompanyUpdate) => {
                    setCompanyFromMutation(data);
                    onboardingState.refetch();
                  },
                }
              )
            }
            disabled={selectShape.isPending}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all duration-150 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {selectShape.isPending ? (
              'Menyimpan Konfigurasi…'
            ) : (
              <>
                <span>Lanjutkan: {currentSelected.name.split(' ')[0]}</span>
                <ArrowRightIcon className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>,
      'max-w-5xl'
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

