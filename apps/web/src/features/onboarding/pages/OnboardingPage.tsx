import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, CurrencyInput } from '@/components/ui';
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
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useCompany } from '@/contexts/CompanyContext';
import { trpc } from '@/lib/trpc';
import {
  BusinessShape,
  CompanyOnboardingStatus,
  CompanyOnboardingStep,
  PaymentMethodType,
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

interface SavedAccountMeta {
  name: string;
  type: typeof PaymentMethodType.CASH | typeof PaymentMethodType.BANK;
  code?: string;
  balance: number;
  accountId?: string;
}

interface SavedOpeningBalanceMeta {
  cash?: number;
  bank?: number;
  total?: number;
  journalId?: string;
  accounts?: SavedAccountMeta[];
}

function parseOpeningBalanceMeta(raw: unknown): SavedOpeningBalanceMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!('openingBalance' in obj) || !obj.openingBalance || typeof obj.openingBalance !== 'object') {
    return null;
  }
  const ob = obj.openingBalance as Record<string, unknown>;
  const total = typeof ob.total === 'number' ? ob.total : undefined;
  const cash = typeof ob.cash === 'number' ? ob.cash : undefined;
  const bank = typeof ob.bank === 'number' ? ob.bank : undefined;
  const journalId = typeof ob.journalId === 'string' ? ob.journalId : undefined;

  let accounts: SavedAccountMeta[] | undefined = undefined;
  if (Array.isArray(ob.accounts)) {
    accounts = ob.accounts
      .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === 'object'))
      .map((a) => ({
        name: typeof a.name === 'string' ? a.name : '',
        type: a.type === PaymentMethodType.CASH ? PaymentMethodType.CASH : PaymentMethodType.BANK,
        code: typeof a.code === 'string' ? a.code : undefined,
        balance: typeof a.balance === 'number' ? a.balance : 0,
        accountId: typeof a.accountId === 'string' ? a.accountId : undefined,
      }));
  }

  return { total, cash, bank, journalId, accounts };
}

const ONBOARDING_STEPS_META = [
  { id: 'BUSINESS_SHAPE', label: 'Tipe Bisnis', number: 1 },
  { id: 'OPENING_BALANCE', label: 'Saldo Awal', number: 2 },
  { id: 'ALIVE_MOMENT', label: 'Selesai', number: 3 },
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
  const complete = trpc.onboarding.complete.useMutation();

  const [accounts, setAccounts] = useState<
    Array<{
      id: string;
      name: string;
      type: typeof PaymentMethodType.CASH | typeof PaymentMethodType.BANK;
      balance: number;
    }>
  >([
    { id: '1', name: 'Kas Utama / Tunai', type: PaymentMethodType.CASH, balance: 0 },
    { id: '2', name: 'Rekening Bank Operasional', type: PaymentMethodType.BANK, balance: 0 },
  ]);

  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  const totalCash = useMemo(() => {
    return accounts
      .filter((a) => a.type === PaymentMethodType.CASH)
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  const totalBank = useMemo(() => {
    return accounts
      .filter((a) => a.type === PaymentMethodType.BANK)
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  const handleAddAccount = (
    type: typeof PaymentMethodType.CASH | typeof PaymentMethodType.BANK
  ) => {
    const id = String(Date.now());
    const count = accounts.filter((a) => a.type === type).length + 1;
    const defaultName =
      type === PaymentMethodType.CASH ? `Kas Tunai ${count}` : `Rekening Bank ${count}`;
    setAccounts((prev) => [
      ...prev,
      { id, name: defaultName, type, balance: 0 },
    ]);
  };

  const handleUpdateAccount = (
    id: string,
    updates: Partial<{
      name: string;
      type: typeof PaymentMethodType.CASH | typeof PaymentMethodType.BANK;
      balance: number;
    }>
  ) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, ...updates } : acc))
    );
  };

  const handleRemoveAccount = (id: string) => {
    if (accounts.length <= 1) return;
    setAccounts((prev) => prev.filter((acc) => acc.id !== id));
  };

  const [selectedShape, setSelectedShape] = useState<BusinessShape>(() =>
    parseBusinessShape(currentCompany?.businessShape)
  );
  const [activeStepOverride, setActiveStepOverride] = useState<CompanyOnboardingStep | null>(null);

  const savedMeta = useMemo(() => {
    return parseOpeningBalanceMeta(onboardingState.data?.onboardingMeta);
  }, [onboardingState.data?.onboardingMeta]);

  // Synchronize saved accounts from server if available
  useEffect(() => {
    if (savedMeta?.accounts && savedMeta.accounts.length > 0) {
      setAccounts(
        savedMeta.accounts.map((acc, index) => ({
          id: acc.accountId ?? String(index + 1),
          name: acc.name,
          type: acc.type,
          balance: acc.balance,
        }))
      );
    }
  }, [savedMeta]);

  const displayTotalBalance = savedMeta?.total ?? totalBalance;
  const displayAccounts =
    savedMeta?.accounts && savedMeta.accounts.length > 0
      ? savedMeta.accounts
      : accounts;

  useEffect(() => {
    if (currentCompany?.businessShape) {
      setSelectedShape(parseBusinessShape(currentCompany.businessShape));
    }
  }, [currentCompany?.businessShape]);

  const serverStep = useMemo(() => {
    if (!onboardingState.data) return CompanyOnboardingStep.WELCOME;
    return normalizeStep(onboardingState.data.onboardingStep);
  }, [onboardingState.data]);

  const serverStepNumber = useMemo(() => {
    switch (serverStep) {
      case CompanyOnboardingStep.BUSINESS_SHAPE:
      case CompanyOnboardingStep.WELCOME:
        return 1;
      case CompanyOnboardingStep.OPENING_BALANCE:
        return 2;
      case CompanyOnboardingStep.FIRST_TRANSACTION:
      case CompanyOnboardingStep.ALIVE_MOMENT:
      case CompanyOnboardingStep.DONE:
        return 3;
      default:
        return 1;
    }
  }, [serverStep]);

  const effectiveServerStep =
    serverStep === CompanyOnboardingStep.FIRST_TRANSACTION
      ? CompanyOnboardingStep.ALIVE_MOMENT
      : serverStep;

  const step = activeStepOverride ?? effectiveServerStep;

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
      case CompanyOnboardingStep.ALIVE_MOMENT:
      case CompanyOnboardingStep.DONE:
        return 3;
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

      {/* Main Container - well-spaced from top */}
      <main className={`relative z-10 mx-auto w-full ${maxWidth} px-4 pt-10 pb-16 sm:px-6`}>
        {/* Progress Stepper: 3 Equal Level Cards with Guaranteed Zero Height Jump */}
        <nav aria-label="Progress" className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {ONBOARDING_STEPS_META.map((s) => {
              const isCurrent = s.number === currentStepNumber;
              const isServerPassed = s.number < serverStepNumber;
              const isAccessible = s.number <= serverStepNumber;

              return (
                <button
                  type="button"
                  key={s.id}
                  disabled={!isAccessible}
                  onClick={() => {
                    if (isAccessible) {
                      const targetStep = s.id as CompanyOnboardingStep;
                      setActiveStepOverride(targetStep === serverStep ? null : targetStep);
                    }
                  }}
                  className={`group flex flex-col justify-between h-[84px] rounded-2xl border p-3.5 text-left transition-all duration-200 bg-white ${
                    isCurrent
                      ? 'border-blue-600 shadow-sm shadow-blue-600/10 ring-1 ring-blue-500/20'
                      : isServerPassed
                      ? 'border-slate-200/90 shadow-2xs hover:border-blue-400 hover:shadow-xs cursor-pointer'
                      : isAccessible
                      ? 'border-blue-200/80 shadow-2xs hover:border-blue-400 hover:shadow-xs cursor-pointer'
                      : 'border-slate-200/60 opacity-50 cursor-not-allowed'
                  }`}
                >
                  {/* Progress Bar Track: Strictly identical Y position in all 4 cards */}
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full w-full rounded-full transition-all duration-300 ${
                        isCurrent
                          ? 'bg-blue-600'
                          : isServerPassed
                          ? 'bg-emerald-500'
                          : 'bg-transparent'
                      }`}
                    />
                  </div>

                  {/* Step Number & Indicator Row: Fixed h-4 */}
                  <div className="flex items-center justify-between h-4">
                    <span
                      className={`text-[11px] font-bold tabular-nums tracking-wide uppercase ${
                        isCurrent
                          ? 'text-blue-600'
                          : isServerPassed
                          ? 'text-emerald-700'
                          : isAccessible
                          ? 'text-slate-600 group-hover:text-blue-600'
                          : 'text-slate-400'
                      }`}
                    >
                      Langkah 0{s.number}
                    </span>

                    <div className="flex items-center justify-center w-4 h-4">
                      {isCurrent ? (
                        <span className="h-2 w-2 rounded-full bg-blue-600 ring-2 ring-blue-100 shrink-0" />
                      ) : isServerPassed ? (
                        <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : isAccessible ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-200 shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Step Label: Fixed 1 line */}
                  <span
                    className={`text-xs font-semibold tracking-tight truncate ${
                      isCurrent
                        ? 'text-slate-900'
                        : isServerPassed
                        ? 'text-slate-700'
                        : isAccessible
                        ? 'text-slate-700 group-hover:text-blue-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
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
      'Langkah 1 dari 3 • Setup Operasional',
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

          <div className="flex flex-col-reverse sm:flex-row items-center gap-3 w-full sm:w-auto">
            {serverStepNumber > 1 && (
              <button
                type="button"
                onClick={() => setActiveStepOverride(null)}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]"
              >
                <span>Batal & Lanjut ke Langkah 0{serverStepNumber}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (
                  selectedShape === currentCompany?.businessShape &&
                  serverStepNumber > 1
                ) {
                  setActiveStepOverride(null);
                  return;
                }
                selectShape.mutate(
                  { shape: selectedShape },
                  {
                    onSuccess: (data: OnboardingCompanyUpdate) => {
                      setActiveStepOverride(null);
                      setCompanyFromMutation(data);
                      onboardingState.refetch();
                    },
                  }
                );
              }}
              disabled={selectShape.isPending}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all duration-150 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selectShape.isPending ? (
                'Menyimpan Konfigurasi…'
              ) : (
                <>
                  <span>
                    {selectedShape === currentCompany?.businessShape && serverStepNumber > 1
                      ? `Lanjut ke Langkah 0${serverStepNumber}`
                      : `Lanjutkan: ${currentSelected.name.split(' ')[0]}`}
                  </span>
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>,
      'max-w-5xl'
    );
  }

  // STEP 2: OPENING BALANCE
  if (step === 'OPENING_BALANCE') {
    return shell(
      'Saldo Awal Kas & Bank',
      'Daftarkan akun kas fisik (kasir/toko) dan rekening bank operasional yang Anda miliki saat memulai pembukuan, beserta saldo awalnya masing-masing.',
      'Langkah 2 dari 3 • Posisi Keuangan',
      <div className="space-y-6">
        {/* Top Control Bar: Counters & Action Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Daftar Akun Kas & Bank
              </h2>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {accounts.length} Akun
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Setiap akun otomatis didaftarkan ke Bagan Akun (CoA) dan metode pembayaran aktif.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Segmented Add Control */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/80 p-0.5">
              <button
                type="button"
                onClick={() => handleAddAccount('CASH')}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white hover:text-slate-900 hover:shadow-2xs transition active:scale-95 cursor-pointer"
              >
                <PlusIcon className="h-3.5 w-3.5 text-emerald-600" />
                <span>Kas</span>
              </button>
              <div className="h-3.5 w-px bg-slate-200" />
              <button
                type="button"
                onClick={() => handleAddAccount('BANK')}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white hover:text-slate-900 hover:shadow-2xs transition active:scale-95 cursor-pointer"
              >
                <PlusIcon className="h-3.5 w-3.5 text-blue-600" />
                <span>Rekening Bank</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Accounts List */}
        <div className="space-y-3">
          {accounts.map((acc, index) => {
            const isCash = acc.type === PaymentMethodType.CASH;

            return (
              <div
                key={acc.id}
                className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all duration-150 hover:border-slate-300 hover:shadow-sm"
              >
                {/* Left: Type Indicator & Name Input */}
                <div className="flex items-center gap-3 w-full sm:w-auto sm:flex-1">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg select-none ${
                      isCash
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70'
                        : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/70'
                    }`}
                  >
                    {isCash ? '💵' : '🏦'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateAccount(acc.id, {
                            type: isCash ? 'BANK' : 'CASH',
                          })
                        }
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                          isCash
                            ? 'bg-emerald-100/70 text-emerald-800 hover:bg-emerald-200/60'
                            : 'bg-blue-100/70 text-blue-800 hover:bg-blue-200/60'
                        }`}
                        title="Klik untuk ubah jenis akun (Kas / Bank)"
                      >
                        {isCash ? 'Kas Fisik' : 'Rekening Bank'}
                      </button>
                      <span className="text-[11px] text-slate-400">
                        #{index + 1}
                      </span>
                    </div>

                    <input
                      type="text"
                      value={acc.name}
                      onChange={(e) =>
                        handleUpdateAccount(acc.id, { name: e.target.value })
                      }
                      placeholder={
                        isCash
                          ? 'Nama kas (cth: Kas Kasir / Toko)'
                          : 'Nama bank (cth: Bank BCA Operasional)'
                      }
                      className="w-full rounded-lg border-0 p-0 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-0"
                    />
                  </div>
                </div>

                {/* Right: Balance CurrencyInput & Delete Action */}
                <div className="flex items-center gap-3 w-full sm:w-auto sm:min-w-[280px]">
                  <div className="flex-1">
                    <CurrencyInput
                      value={acc.balance}
                      onChange={(val) =>
                        handleUpdateAccount(acc.id, { balance: val })
                      }
                      placeholder="0"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={accounts.length <= 1}
                    onClick={() => handleRemoveAccount(acc.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Hapus akun"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Subtotal Kas Tunai</span>
            <p className="mt-1 font-mono text-base font-bold text-slate-900">
              Rp {totalCash.toLocaleString('id-ID')}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Subtotal Rekening Bank</span>
            <p className="mt-1 font-mono text-base font-bold text-slate-900">
              Rp {totalBank.toLocaleString('id-ID')}
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700">Total Saldo Awal</span>
              <BanknotesIcon className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-1 font-mono text-base font-bold text-blue-700">
              Rp {totalBalance.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveStepOverride(CompanyOnboardingStep.BUSINESS_SHAPE)}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]"
          >
            <ArrowLeftIcon className="h-4 w-4 text-slate-400" />
            <span>Kembali ke Tipe Bisnis</span>
          </button>

          <button
            type="button"
            onClick={() =>
              submitOpeningBalance.mutate(
                {
                  accounts: accounts.map((a) => ({
                    name: a.name.trim() || (a.type === PaymentMethodType.CASH ? 'Kas' : 'Bank'),
                    type: a.type,
                    balance: a.balance || 0,
                  })),
                },
                {
                  onSuccess: (data: OnboardingCompanyUpdate) => {
                    setActiveStepOverride(null);
                    setCompanyFromMutation(data);
                    onboardingState.refetch();
                  },
                }
              )
            }
            disabled={submitOpeningBalance.isPending}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all duration-150 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
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
      </div>
    );
  }

  // STEP 3: ALIVE MOMENT (CELEBRATION & COMPLETION)
  if (step === 'ALIVE_MOMENT' || step === 'FIRST_TRANSACTION') {
    const shapeLabel =
      selectedShape === BusinessShape.RENTAL
        ? 'Rental & Persewaan Aset'
        : selectedShape === BusinessShape.SERVICE
          ? 'Jasa Profesional'
          : selectedShape === BusinessShape.MANUFACTURING
            ? 'Manufaktur & Produksi'
            : 'Retail & Perdagangan';

    return shell(
      'Sistem Siap Digunakan',
      `Konfigurasi operasional dan saldo awal kas/bank untuk ${currentCompany.name} telah selesai diverifikasi.`,
      'Langkah 3 dari 3 • Konfirmasi & Selesai',
      <div className="space-y-6">
        {/* Readiness Banner */}
        <div className="flex items-center gap-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50/50 p-4 sm:p-5 shadow-2xs">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
            <CheckCircleIcon className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {currentCompany.name} Siap Memulai Operasional
            </h3>
            <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
              Bagan akun (CoA) telah aktif dan jurnal saldo awal seimbang telah dibukukan secara otomatis di Buku Besar.
            </p>
          </div>
        </div>

        {/* Configuration Summary 3 Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Model Bisnis
              </span>
              <p className="mt-1 text-sm font-bold text-slate-900">{shapeLabel}</p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedShape === BusinessShape.RENTAL
                  ? 'Katalog sewa, tracking deposit & siklus sewa aktif'
                  : 'Modul & alur transaksi aktif'}
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckIcon className="h-3.5 w-3.5" />
              <span>Modul Diaktifkan</span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Saldo Awal
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  {displayAccounts.length} Akun
                </span>
              </div>
              <p className="mt-1 font-mono text-base font-bold text-slate-900">
                Rp {displayTotalBalance.toLocaleString('id-ID')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Modal awal pemilik tercatat
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckIcon className="h-3.5 w-3.5" />
              <span>Terhubung ke Kas & Bank</span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                General Ledger
              </span>
              <p className="mt-1 text-sm font-bold text-slate-900">CoA Standar Aktif</p>
              <p className="mt-1 text-xs text-slate-500">
                Jurnal saldo awal #ONBOARDING_OPENING_BALANCE
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckIcon className="h-3.5 w-3.5" />
              <span>Jurnal Pembukuan Seimbang</span>
            </div>
          </div>
        </div>

        {/* Registered Accounts Chips Preview */}
        {displayAccounts.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Daftar Akun Kas & Bank yang Terdaftar:
              </span>
              <span className="text-[11px] text-slate-500">
                Total Saldo: <strong className="font-mono text-slate-900 font-bold">Rp {displayTotalBalance.toLocaleString('id-ID')}</strong>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {displayAccounts.map((acc, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs shadow-2xs"
                >
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      acc.type === PaymentMethodType.CASH
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    {acc.type}
                  </span>
                  <span className="font-medium text-slate-800">{acc.name}</span>
                  <span className="font-mono font-bold text-slate-900">
                    Rp {(acc.balance || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actionable Next Steps in Dashboard */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <SparklesIcon className="h-4 w-4 text-amber-500" />
            <span>Langkah Selanjutnya di Dashboard:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <span className="text-xs font-bold text-slate-800 block">1. Katalog Barang Sewa</span>
              <span className="text-[11px] text-slate-500 mt-1 block leading-normal">
                Daftarkan unit rental, tentukan tarif per periode & nominal deposit jaminan.
              </span>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <span className="text-xs font-bold text-slate-800 block">2. Pesanan & Pelanggan</span>
              <span className="text-[11px] text-slate-500 mt-1 block leading-normal">
                Buat pesanan sewa perdana atau simpan kontak pelanggan ke database.
              </span>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <span className="text-xs font-bold text-slate-800 block">3. Profil & Rekening Usaha</span>
              <span className="text-[11px] text-slate-500 mt-1 block leading-normal">
                Lengkapi logo, alamat, dan nomor rekening pada kop faktur invoice.
              </span>
            </div>
          </div>
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveStepOverride(CompanyOnboardingStep.OPENING_BALANCE)}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] cursor-pointer"
          >
            <ArrowLeftIcon className="h-4 w-4 text-slate-400" />
            <span>Kembali ke Saldo Awal</span>
          </button>

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
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-150 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {complete.isPending ? (
              'Membuka Dashboard...'
            ) : (
              <>
                <span>Buka Dashboard Workspace Sekarang</span>
                <ArrowRightIcon className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>,
      'max-w-5xl'
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

